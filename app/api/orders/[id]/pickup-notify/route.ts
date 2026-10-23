import { NextResponse } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import prisma from '@/lib/db';
import { sendPickupScheduleSms } from '@/lib/order-sms';
import { dateLabel, slotLabel } from '@/lib/pickup';

/**
 * اطلاع‌رسانی پیامکی برنامه تحویل حضوری به مشتری — با کلیک «اطلاع‌رسانی» در
 * لیست تحویل حضوری، برنامه فعلی (+ علت آخرین تغییر) پیامک می‌شود.
 * دسترسی /orders/pickup:edit.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/orders/pickup', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      displayId: true,
      amount: true,
      date: true,
      paymentRefId: true,
      trackingCode: true,
      userId: true,
      pickupSlotId: true,
      pickupDate: true,
      pickupChangeNote: true,
    },
  });
  if (!order || !order.pickupSlotId || !order.pickupDate) {
    return NextResponse.json({ error: 'سفارش تحویل حضوری یافت نشد.' }, { status: 404 });
  }

  const slot = await prisma.pickupSlot.findUnique({ where: { id: order.pickupSlotId } });
  if (!slot) {
    return NextResponse.json({ error: 'بازه زمانی سفارش یافت نشد.' }, { status: 404 });
  }

  const result = await sendPickupScheduleSms({
    order: {
      displayId: order.displayId,
      amount: order.amount,
      date: order.date,
      paymentRefId: order.paymentRefId,
      trackingCode: order.trackingCode,
      userId: order.userId,
    },
    schedule: {
      date: dateLabel(order.pickupDate),
      time: slotLabel(slot),
    },
    reason: order.pickupChangeNote ?? undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
