import { NextResponse } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { markPickupDelivered } from '@/lib/pickup';

/**
 * ثبت تحویل حضوری یک سفارش — کاربر دارای دسترسی /orders/pickup:edit وضعیت
 * سفارشِ پرداخت‌شدهِ رزروشده را «تحویل شده» می‌کند.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/orders/pickup', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;
  const result = await markPickupDelivered(id);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
