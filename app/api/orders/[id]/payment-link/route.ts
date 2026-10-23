import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { requireApiUser } from '@/lib/api-auth';
import { isInPersonDeliveryEnabled } from '@/lib/core-license';
import { validateCouponForOrder } from '@/lib/coupons';
import prisma from '@/lib/db';
import { fromFaDigits } from '@/lib/format';
import { sendPaymentLinkSms } from '@/lib/order-sms';
import { dateLabel, slotLabel, validatePickupReservation } from '@/lib/pickup';
import { parseItems } from '@/lib/shop-orders';

interface PaymentLinkBody {
  mobile?: unknown;
  addressId?: unknown;
  shippingMethodId?: unknown;
  couponCode?: unknown;
  pickupLocationId?: unknown;
  pickupSlotId?: unknown;
  pickupDate?: unknown;
}

/**
 * Shares the order's payment link: snapshots the checkout picks (address,
 * shipping method, coupon) on the order exactly like the pay route would,
 * mints the order's payment token (reused across shares), and texts the
 * admin-configured link SMS to the given mobile. The recipient then views and
 * pays the invoice at /pay/{token} — no login, no changes.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;

  let body: PaymentLinkBody;
  try {
    body = (await request.json()) as PaymentLinkBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const mobile = typeof body.mobile === 'string' ? fromFaDigits(body.mobile).trim() : '';
  if (!/^09\d{9}$/.test(mobile)) {
    return NextResponse.json(
      { error: 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.' },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== session.sub) {
    return NextResponse.json({ error: 'سفارش یافت نشد.' }, { status: 404 });
  }
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'این سفارش در وضعیت قابل پرداخت نیست.' }, { status: 400 });
  }

  // Same shipping-method rule as checkout: only the admin's ACTIVE methods.
  if (typeof body.shippingMethodId !== 'string' || body.shippingMethodId === '') {
    return NextResponse.json({ error: 'روش ارسال را انتخاب کنید.' }, { status: 400 });
  }
  const shippingMethod = await prisma.shippingMethod.findFirst({
    where: { id: body.shippingMethodId, isActive: true },
  });
  if (!shippingMethod) {
    return NextResponse.json(
      { error: 'روش ارسال انتخابی در دسترس نیست. دوباره تلاش کنید.' },
      { status: 400 }
    );
  }
  const isPickup = shippingMethod.kind === 'pickup';

  let address: {
    title: string;
    receiverName: string;
    receiverPhone: string;
    body: string;
    postalCode: string | null;
  } | null = null;
  let pickup: {
    location: { title: string; address: string };
    slot: { startMinute: number; endMinute: number };
  } | null = null;

  if (isPickup) {
    if (!(await isInPersonDeliveryEnabled())) {
      return NextResponse.json({ error: 'تحویل حضوری فعال نیست.' }, { status: 403 });
    }
    if (
      typeof body.pickupLocationId !== 'string' ||
      body.pickupLocationId === '' ||
      typeof body.pickupSlotId !== 'string' ||
      body.pickupSlotId === '' ||
      typeof body.pickupDate !== 'string' ||
      body.pickupDate === ''
    ) {
      return NextResponse.json(
        { error: 'نقطه، روز و بازه زمانی تحویل حضوری را انتخاب کنید.' },
        { status: 400 }
      );
    }
    const reservation = await validatePickupReservation({
      locationId: body.pickupLocationId,
      slotId: body.pickupSlotId,
      date: body.pickupDate,
    });
    if ('error' in reservation) {
      return NextResponse.json({ error: reservation.error }, { status: 400 });
    }
    pickup = reservation;
  } else {
    if (typeof body.addressId !== 'string' || body.addressId === '') {
      return NextResponse.json({ error: 'آدرس تحویل را انتخاب کنید.' }, { status: 400 });
    }
    const found = await prisma.address.findFirst({
      where: { id: body.addressId, userId: session.sub },
    });
    if (!found) {
      return NextResponse.json({ error: 'آدرس انتخابی یافت نشد.' }, { status: 400 });
    }
    address = found;
  }

  // تحویل حضوری هزینه ارسال ندارد.
  const shippingCost = isPickup
    ? 0
    : shippingMethod.isInvoiced
      ? shippingMethod.minShippingCost
      : 0;

  // Optional coupon — validated exactly like checkout so the shared invoice
  // shows the same payable the owner sees.
  let couponCode: string | null = null;
  let discountAmount = 0;
  if (typeof body.couponCode === 'string' && body.couponCode.trim() !== '') {
    const validation = await validateCouponForOrder(body.couponCode, {
      amount: order.amount,
      userId: session.sub,
      items: parseItems(order.itemsJson),
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    couponCode = validation.coupon.code;
    discountAmount = validation.discount;
  }

  const payable = order.amount - discountAmount + shippingCost;

  const snapshot = isPickup
    ? [
        `تحویل حضوری — ${pickup?.location.title ?? ''}`,
        pickup?.location.address ?? '',
        pickup
          ? `رزرو: ${dateLabel(typeof body.pickupDate === 'string' ? body.pickupDate : '')}، ${slotLabel(pickup.slot)}`
          : '',
      ]
        .filter(Boolean)
        .join(' — ')
    : [
        address?.title ?? '',
        address?.receiverName ?? '',
        address?.receiverPhone ?? '',
        address?.body ?? '',
        address?.postalCode ? `کدپستی ${address.postalCode}` : '',
      ]
        .filter(Boolean)
        .join(' — ');

  // The token is the share capability: minted once per order, reused on
  // re-shares so earlier SMS links keep working.
  const paymentToken = order.paymentToken ?? randomBytes(16).toString('hex');

  const stored = await prisma.order.update({
    where: { id: order.id },
    data: {
      deliveryMethod: shippingMethod.name,
      shippingCost,
      deliveryAddress: snapshot,
      couponCode,
      discountAmount,
      pickupLocationId: isPickup ? (body.pickupLocationId as string) : null,
      pickupSlotId: isPickup ? (body.pickupSlotId as string) : null,
      pickupDate: isPickup ? (body.pickupDate as string) : null,
      paymentToken,
    },
  });

  const link = `${request.nextUrl.origin}/pay/${paymentToken}`;
  const sms = await sendPaymentLinkSms({
    receptor: mobile,
    order: {
      displayId: stored.displayId,
      amount: payable,
      date: stored.date,
      paymentRefId: null,
      trackingCode: null,
      userId: stored.userId,
    },
    link,
  });

  if (!sms.ok) {
    return NextResponse.json({ error: sms.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
