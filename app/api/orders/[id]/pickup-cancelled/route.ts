import { NextResponse } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { cancelOrderById } from '@/lib/order-cancel';
import { logSystemEvent } from '@/lib/system-logs';

/**
 * لغو سفارش از لیست تحویل حضوری — همان منطق لغو fulfillment (بازگشت وجه
 * پرداخت‌شده به کیف پول + پس‌گرفتن کد تخفیف) با دسترسی /orders/pickup:edit.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/orders/pickup', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;
  const result = await cancelOrderById(id);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await logSystemEvent({
    kind: 'order',
    provider: 'pickup',
    action: 'pickup_cancel',
    message: `سفارش ${id} از تحویل حضوری لغو شد${result.refunded > 0 ? ' و مبلغ به کیف پول برگشت' : ''}.`,
    actorName: session.name,
  });
  return NextResponse.json({ ok: true, status: result.status, refunded: result.refunded });
}
