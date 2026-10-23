import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { isInPersonDeliveryEnabled, licensedGatewayIds } from '@/lib/core-license';
import { validateCouponForOrder } from '@/lib/coupons';
import prisma from '@/lib/db';
import { activeGatewaysFor, defaultGatewayFor, getGateway } from '@/lib/gateways/registry';
import { sendOrderFactorSms } from '@/lib/order-sms';
import { dateLabel, slotLabel, validatePickupReservation } from '@/lib/pickup';
import { getAppSettings } from '@/lib/settings';
import { parseItems } from '@/lib/shop-orders';
import { logSystemError } from '@/lib/system-logs';
import { payOrderFromWallet } from '@/lib/wallet';

interface CheckoutBody {
  addressId?: unknown;
  couponCode?: unknown;
  /** Gateway pick from the checkout form (must be active + configured). */
  gateway?: unknown;
  /** Shipping-method (روش ارسال) pick — must be one of the active methods. */
  shippingMethodId?: unknown;
  /** تحویل حضوری — نقطه/بازه/تاریخ رزرو (وقتی روش ارسال از نوع pickup است). */
  pickupLocationId?: unknown;
  pickupSlotId?: unknown;
  pickupDate?: unknown;
}

/**
 * Pays a pending order — wallet-first, per the shop's payment model:
 *
 *  1. A shipping method (روش ارسال) is resolved: it must be one of the admin's
 *     ACTIVE methods. Its name is snapshotted as the order's deliveryMethod,
 *     and its cost — 0 for پس‌کرایه methods — joins the payable amount.
 *  2. A coupon code (optional) is validated and its discount stored on the
 *     order; the payable amount is amount − discountAmount + shippingCost.
 *  3. When the wallet balance covers the payable amount the order is paid
 *     instantly from the wallet (balance debited, order marked paid, factor
 *     SMS sent) — the response says `paid: true`.
 *  4. Otherwise the shortfall is charged through the selected gateway (one of
 *     the admin's active, configured gateways — default the admin's default):
 *     the gateway money lands in the wallet on the callback, which then
 *     auto-pays this order. The response carries the gateway redirect URL, or
 *     a form-POST relay (postUrl + postFields) for Saman/Sepah/SizPay.
 *
 * Every attempt — instant or gateway — is recorded as an
 * OnlinePaymentTransaction row.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;

  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== session.sub) {
    return NextResponse.json({ error: 'سفارش یافت نشد.' }, { status: 404 });
  }
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'این سفارش در وضعیت قابل پرداخت نیست.' }, { status: 400 });
  }

  // روش ارسال اول حل می‌شود — نوعش (courier/pickup) تعیین می‌کند اصلاً آدرس
  // لازم است یا نقطه/بازه تحویل حضوری.
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

  // تحویل حضوری: فیچر باید در Core برای این دامنه فعال باشد.
  if (isPickup && !(await isInPersonDeliveryEnabled())) {
    return NextResponse.json({ error: 'تحویل حضوری فعال نیست.' }, { status: 403 });
  }

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
    // اعتبارسنجی رزرو: نقطه فعال، بازه متعلق به نقطه، روز غیرتعطیل، ظرفیت باز.
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

    // The address must belong to the caller — an id from another user's book
    // is simply not found.
    const found = await prisma.address.findFirst({
      where: { id: body.addressId, userId: session.sub },
    });
    if (!found) {
      return NextResponse.json({ error: 'آدرس انتخابی یافت نشد.' }, { status: 400 });
    }
    address = found;
  }

  // تحویل حضوری هزینه ارسال ندارد — مراجعه حضوری است.
  const shippingCost = isPickup
    ? 0
    : shippingMethod.isInvoiced
      ? shippingMethod.minShippingCost
      : 0;

  // Optional coupon: validate against this customer + order and store the discount.
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

  // اسنپ‌شات تحویل: ارسالی = آدرس مشتری؛ حضوری = نقطه + بازه + تاریخ رزرو.
  const snapshot = isPickup
    ? [
        `تحویل حضوری — ${pickup?.location.title ?? ''}`,
        pickup?.location.address ?? '',
        pickup ? `رزرو: ${dateLabel(body.pickupDate as string)}، ${slotLabel(pickup.slot)}` : '',
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
    },
  });

  const balance = await prisma.user
    .findUnique({ where: { id: session.sub }, select: { walletBalance: true } })
    .then((user) => user?.walletBalance ?? 0);

  // Instant path: the wallet already covers the payable amount.
  if (balance >= payable) {
    const paid = await prisma.$transaction((tx) =>
      payOrderFromWallet(tx, {
        order: {
          id: stored.id,
          displayId: stored.displayId,
          userId: stored.userId,
          couponCode: stored.couponCode,
        },
        payable,
      })
    );

    if (!paid) {
      return NextResponse.json(
        { error: 'موجودی کیف پول در لحظه پرداخت کافی نبود. دوباره تلاش کنید.' },
        { status: 409 }
      );
    }

    // Factor SMS — failure must not fail the payment, just log it.
    try {
      const sms = await sendOrderFactorSms({
        order: {
          displayId: stored.displayId,
          amount: payable,
          date: stored.date,
          paymentRefId: null,
          trackingCode: null,
          userId: stored.userId,
        },
        refId: null,
      });
      if (!sms.ok) {
        console.error(`Factor SMS for order ${stored.displayId} failed: ${sms.error}`);
      }
    } catch (error) {
      console.error(`Factor SMS dispatch for order ${stored.displayId} failed:`, error);
    }

    return NextResponse.json({ paid: true });
  }

  // Gateway path: charge the shortfall into the wallet; the callback verifies,
  // credits the wallet and auto-pays this order.
  const settings = await getAppSettings();
  // درگاه‌های مجاز پلن Core برای این دامنه (بند ۲-۸/۲-۹) — null یعنی Core
  // غایب است و همه‌ی درگاه‌های آماده‌ی پنل مجازند.
  const licensed = await licensedGatewayIds();
  const ready = activeGatewaysFor(settings);
  const available = licensed ? ready.filter((g) => licensed.has(g.id)) : ready;
  if (available.length === 0) {
    return NextResponse.json(
      {
        error: licensed
          ? 'هیچ درگاه پرداختی برای این سایت فعال نیست. با پشتیبانی تماس بگیرید.'
          : 'درگاه پرداختی پیکربندی نشده است. با پشتیبانی فروشگاه تماس بگیرید.',
      },
      { status: 400 }
    );
  }

  const requestedGateway =
    typeof body.gateway === 'string' && available.some((g) => g.id === body.gateway)
      ? getGateway(body.gateway)
      : null;
  const fallbackGateway = defaultGatewayFor(settings);
  const gateway =
    requestedGateway ??
    (fallbackGateway && available.some((g) => g.id === fallbackGateway.id)
      ? fallbackGateway
      : available[0]);
  if (!gateway) {
    return NextResponse.json(
      { error: 'درگاه انتخابی در دسترس نیست. دوباره تلاش کنید.' },
      { status: 400 }
    );
  }

  const shortfall = payable - balance;

  const result = await gateway.start({
    settings,
    amountToman: shortfall,
    providerId: stored.displayId,
    callbackUrl: `${request.nextUrl.origin}/api/payment/callback`,
    mobile: session.phone,
    description: `شارژ کیف پول و پرداخت سفارش ${stored.displayId}`,
    items: parseItems(stored.itemsJson).map((item) => ({
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice,
    })),
  });

  if (!result.ok) {
    // The gateway said something the customer can't act on — keep the raw
    // API error for the admin's system-log page.
    await logSystemError({
      kind: 'gateway',
      provider: gateway.id,
      action: 'start',
      message: result.error,
      detail: result.detail,
    });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.onlinePaymentTransaction.create({
      data: {
        userId: session.sub,
        kind: 'wallet_charge',
        amount: shortfall,
        state: 'pending',
        gateway: gateway.id,
        // The gateway's in-flight token (ZarinPal authority, Saman token, …)
        // doubles as the unique authority column; gateways without one are
        // looked up by providerId on the callback.
        authority: result.token ?? null,
        providerId: result.providerId,
        refId: result.token ?? null,
        orderId: stored.id,
      },
    });
    await tx.order.update({
      where: { id: stored.id },
      data: { paymentAuthority: result.providerId },
    });
  });

  return NextResponse.json({
    redirectUrl: result.redirectUrl,
    postUrl: result.postUrl ?? null,
    postFields: result.postFields ?? null,
    chargeAmount: shortfall,
  });
}
