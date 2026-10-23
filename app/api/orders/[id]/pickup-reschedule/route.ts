import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { reschedulePickup } from '@/lib/pickup';
import { logSystemEvent } from '@/lib/system-logs';

/**
 * تغییر تاریخ/بازه تحویل حضوری یک سفارش توسط مالک — با علت (اجباری) که در
 * صفحه سفارش‌های منِ مشتری نمایش داده می‌شود. دسترسی /orders/pickup:edit.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/orders/pickup', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;

  let body: { date?: unknown; slotId?: unknown; note?: unknown };
  try {
    body = (await request.json()) as { date?: unknown; slotId?: unknown; note?: unknown };
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  if (
    typeof body.date !== 'string' ||
    typeof body.slotId !== 'string' ||
    typeof body.note !== 'string'
  ) {
    return NextResponse.json({ error: 'روز، بازه زمانی و علت تغییر الزامی است.' }, { status: 400 });
  }

  const result = await reschedulePickup(id, {
    date: body.date,
    slotId: body.slotId,
    note: body.note,
  });
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await logSystemEvent({
    kind: 'order',
    provider: 'pickup',
    action: 'pickup_reschedule',
    message: `تحویل حضوری سفارش ${id} به «${result.dateLabel} — ${result.slotLabel}» تغییر کرد.`,
    actorName: session.name,
    detail: `علت: ${body.note}`,
  });
  return NextResponse.json({
    ok: true,
    dateLabel: result.dateLabel,
    slotLabel: result.slotLabel,
  });
}
