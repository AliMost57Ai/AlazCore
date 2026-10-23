import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import prisma from '@/lib/db';
import { faNumber } from '@/lib/format';
import { STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import { sendOrderNoticeSms } from '@/lib/order-sms';
import { logSystemAudit } from '@/lib/system-logs';
import { creditWallet } from '@/lib/wallet';

interface FulfillmentBody {
  action?: unknown;
  trackingCode?: unknown;
  /** Admin-chosen delivery date, 'YYYY-MM-DD'. */
  estimatedArrival?: unknown;
}

/** Parses 'YYYY-MM-DD' into a local midnight Date, or null when invalid. */
function parseArrivalDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }
  const date = new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Records a staff-driven status move in the system log. Never throws — the log
 * is a record of the change, not a precondition for it, so a logging failure
 * must not turn a completed fulfillment step into a 500.
 */
async function logStatusChange(
  order: { displayId: string; status: string },
  next: OrderStatus,
  actor: string,
  detail?: string
): Promise<void> {
  // The boxing/posting guards accept a repeat click on a status the order is
  // already in; that is not a change, so it writes no row.
  if (order.status === next) {
    return;
  }
  const from = STATUS_LABELS[order.status as OrderStatus] ?? order.status;
  await logSystemAudit({
    kind: 'order',
    action: 'status',
    actor,
    message: `وضعیت سفارش ${order.displayId} از «${from}» به «${STATUS_LABELS[next]}» تغییر کرد.`,
    detail: detail ?? '',
  });
}

/**
 * Admin fulfillment flow on a paid order: boxing (being packed), posting
 * (requires a tracking code and the promised delivery date), sending the
 * shipping-notice SMS, and marking the parcel delivered to the customer.
 *
 *  POST { action: 'boxing' }                             → status becomes 'boxing'
 *  POST { action: 'posted', trackingCode, estimatedArrival } → status becomes 'posted'
 *  POST { action: 'notice' }                             → sends the notice SMS
 *  POST { action: 'delivered' }                          → status becomes 'delivered'
 *  POST { action: 'cancelled' }                          → status becomes 'cancelled'
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/orders', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;

  let body: FulfillmentBody;
  try {
    body = (await request.json()) as FulfillmentBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  // Orders are addressed by their human-facing displayId in the UI.
  const order = await prisma.order.findUnique({ where: { displayId: id } });
  if (!order) {
    return NextResponse.json({ error: 'سفارش یافت نشد.' }, { status: 404 });
  }

  const action = typeof body.action === 'string' ? body.action : '';

  if (action === 'boxing') {
    if (order.status !== 'paid' && order.status !== 'boxing') {
      return NextResponse.json(
        { error: 'فقط سفارش‌های پرداخت‌شده قابل بسته‌بندی هستند.' },
        { status: 400 }
      );
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'boxing' },
    });
    await logStatusChange(order, 'boxing', session.name);
    return NextResponse.json({
      order: { status: updated.status, trackingCode: updated.trackingCode },
    });
  }

  if (action === 'posted') {
    if (order.status !== 'boxing' && order.status !== 'posted') {
      return NextResponse.json(
        { error: 'ابتدا سفارش را به حالت بسته‌بندی ببرید.' },
        { status: 400 }
      );
    }

    const trackingCode = typeof body.trackingCode === 'string' ? body.trackingCode.trim() : '';
    if (trackingCode === '' || trackingCode.length > 100) {
      return NextResponse.json(
        { error: 'کد رهگیری مرسوله را وارد کنید (حداکثر ۱۰۰ نویسه).' },
        { status: 400 }
      );
    }

    // The promised delivery date is what the customer's tracking card shows.
    const estimatedArrival = parseArrivalDate(body.estimatedArrival);
    if (!estimatedArrival) {
      return NextResponse.json(
        { error: 'تاریخ تخمینی تحویل به مشتری را انتخاب کنید.' },
        { status: 400 }
      );
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'posted', trackingCode, estimatedArrival },
    });
    await logStatusChange(
      order,
      'posted',
      session.name,
      [`کد رهگیری: ${trackingCode}`, `تاریخ تخمینی تحویل: ${body.estimatedArrival as string}`].join(
        '\n'
      )
    );
    return NextResponse.json({
      order: {
        status: updated.status,
        trackingCode: updated.trackingCode,
        estimatedArrival: updated.estimatedArrival,
      },
    });
  }

  if (action === 'notice') {
    if (order.status !== 'posted') {
      return NextResponse.json(
        { error: 'برای اطلاع‌رسانی، سفارش باید در حالت ارسال شده باشد.' },
        { status: 400 }
      );
    }

    const result = await sendOrderNoticeSms({
      order: {
        displayId: order.displayId,
        amount: order.amount,
        date: order.date,
        paymentRefId: order.paymentRefId,
        trackingCode: order.trackingCode,
        userId: order.userId,
      },
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { notifiedAt: new Date() },
    });
    return NextResponse.json({
      order: { status: updated.status, trackingCode: updated.trackingCode, notified: true },
    });
  }

  if (action === 'delivered') {
    // The courier handed the parcel to the customer — closes the flow.
    if (order.status !== 'posted' && order.status !== 'shipped') {
      return NextResponse.json(
        { error: 'فقط سفارش‌های ارسال‌شده قابل تحویل هستند.' },
        { status: 400 }
      );
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'delivered' },
    });
    await logStatusChange(order, 'delivered', session.name);
    return NextResponse.json({
      order: { status: updated.status, trackingCode: updated.trackingCode },
    });
  }

  if (action === 'cancelled') {
    // Admin takes the order off the rails — allowed from any state except the
    // two terminal ones. A paid order is refunded to the customer's wallet
    // (what they actually paid: the coupon-discounted amount). Stock
    // decremented at order time is not returned (the goods may already be
    // packed/shipped).
    if (order.status === 'delivered' || order.status === 'cancelled') {
      return NextResponse.json(
        { error: 'این سفارش در وضعیت نهایی است و قابل لغو نیست.' },
        { status: 400 }
      );
    }

    if (!order.userId || !order.paidAt) {
      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { status: 'cancelled' },
      });
      await logStatusChange(order, 'cancelled', session.name, 'سفارش پرداخت‌نشده بود؛ مبلغی برگشت نخورد.');
      return NextResponse.json({
        order: { status: updated.status, trackingCode: updated.trackingCode },
      });
    }

    // Refund what the customer actually paid — goods total minus the coupon
    // discount plus the invoiced shipping cost (0 for پس‌کرایه orders).
    const refundable = Math.max(order.amount - order.discountAmount + order.shippingCost, 0);
    const updated = await prisma.$transaction(async (tx) => {
      if (refundable > 0) {
        await creditWallet(tx, {
          userId: order.userId as string,
          amount: refundable,
          type: 'refund',
          reason: `لغو سفارش ${order.displayId}`,
          orderId: order.id,
        });
      }
      // The customer never got the goods, so their coupon use is given back:
      // drop the redemption row and the usedCount it burned.
      if (order.couponCode) {
        const coupon = await tx.coupon.findUnique({
          where: { code: order.couponCode },
          select: { id: true },
        });
        if (coupon) {
          await tx.couponRedemption.deleteMany({
            where: { couponId: coupon.id, userId: order.userId as string },
          });
          await tx.coupon.updateMany({
            where: { id: coupon.id, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          });
        }
      }
      return tx.order.update({
        where: { id: order.id },
        data: { status: 'cancelled' },
      });
    });
    await logStatusChange(
      order,
      'cancelled',
      session.name,
      [
        `مبلغ برگشتی به کیف پول: ${refundable > 0 ? `${faNumber(refundable)} تومان` : 'ندارد'}`,
        order.couponCode ? `کد تخفیف «${order.couponCode}» آزاد شد.` : '',
      ]
        .filter((line) => line !== '')
        .join('\n')
    );
    return NextResponse.json({
      order: { status: updated.status, trackingCode: updated.trackingCode },
      refunded: refundable,
    });
  }

  return NextResponse.json({ error: 'عملیات نامعتبر است.' }, { status: 400 });
}
