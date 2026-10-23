import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import prisma from '@/lib/db';
import { cancelOrderById } from '@/lib/order-cancel';
import { sendOrderNoticeSms } from '@/lib/order-sms';
import { STATUS_LABELS } from '@/lib/order-status';
import { oversellOrderDeficit } from '@/lib/stock';
import { logSystemEvent } from '@/lib/system-logs';

interface FulfillmentBody {
  action?: unknown;
  trackingCode?: unknown;
  /** Admin-chosen delivery date, 'YYYY-MM-DD'. */
  estimatedArrival?: unknown;
  /** پیام اختیاری فروشگاه به مشتری هنگام لغو — روی سفارش می‌نشیند. */
  note?: unknown;
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

    // قفل خالی‌فروشی: سفارشِ شامل خطِ کسریِ باز تا افزایش موجودی جلو نمی‌رود —
    // بعد از شارژ قفسه خط صفر/مثبت می‌شود و مسیر آزاد است.
    if (order.oversell && (await oversellOrderDeficit(order.itemsJson))) {
      return NextResponse.json(
        { error: 'برای ادامه فرآیند، ابتدا موجودی کالای خالی‌فروشی این سفارش را افزایش دهید.' },
        { status: 409 }
      );
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'boxing' },
    });
    await logSystemEvent({
      kind: 'order',
      provider: 'orders',
      action: 'status_change',
      message: `وضعیت سفارش ${order.displayId} به «${STATUS_LABELS.boxing}» تغییر کرد.`,
      actorName: session.name,
      detail: `${order.status} → boxing`,
    });
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

    // ادامه فرآیندِ خالی‌فروشی هم مثل بسته‌بندی تا افزایش موجودی قفل است.
    if (order.oversell && (await oversellOrderDeficit(order.itemsJson))) {
      return NextResponse.json(
        { error: 'برای ادامه فرآیند، ابتدا موجودی کالای خالی‌فروشی این سفارش را افزایش دهید.' },
        { status: 409 }
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
    await logSystemEvent({
      kind: 'order',
      provider: 'orders',
      action: 'status_change',
      message: `سفارش ${order.displayId} ارسال شد — کد رهگیری ${trackingCode}.`,
      actorName: session.name,
      detail: `${order.status} → posted`,
    });
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
    // deliveredAt is the anchor of the return window (مرجوعی کالا).
    if (order.status !== 'posted' && order.status !== 'shipped') {
      return NextResponse.json(
        { error: 'فقط سفارش‌های ارسال‌شده قابل تحویل هستند.' },
        { status: 400 }
      );
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'delivered', deliveredAt: new Date() },
    });
    await logSystemEvent({
      kind: 'order',
      provider: 'orders',
      action: 'status_change',
      message: `سفارش ${order.displayId} تحویل داده شد.`,
      actorName: session.name,
      detail: `${order.status} → delivered`,
    });
    return NextResponse.json({
      order: { status: updated.status, trackingCode: updated.trackingCode },
    });
  }

  if (action === 'cancelled') {
    // Admin takes the order off the rails — allowed from any state except the
    // two terminal ones. A paid order is refunded to the customer's wallet;
    // the shared logic lives in lib/order-cancel.ts (همان منطقِ لیست تحویل
    // حضوری). پیام فروشگاه روی سفارش می‌نشیند و مشتری می‌بیند؛ سفارش
    // خالی‌فروشی بدون پیام، با توضیح «عدم موجودی کالا» لغو می‌شود.
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (note.length > 300) {
      return NextResponse.json({ error: 'پیام به مشتری حداکثر ۳۰۰ نویسه است.' }, { status: 400 });
    }
    const shopNote = note || (order.oversell ? 'عدم موجودی کالا' : undefined);
    const result = await cancelOrderById(order.id, shopNote);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await logSystemEvent({
      kind: 'order',
      provider: 'orders',
      action: 'status_change',
      message: `سفارش ${order.displayId} لغو شد${result.refunded ? ' و مبلغ به کیف پول مشتری برگشت' : ''}.`,
      actorName: session.name,
      detail: `${order.status} → cancelled${shopNote ? ` — پیام: ${shopNote}` : ''}`,
    });
    return NextResponse.json({
      order: { status: result.status, trackingCode: order.trackingCode },
      refunded: result.refunded,
    });
  }

  return NextResponse.json({ error: 'عملیات نامعتبر است.' }, { status: 400 });
}
