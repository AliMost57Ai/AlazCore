import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { removeOrderItem } from '@/lib/order-item-ops';
import { logSystemEvent } from '@/lib/system-logs';

interface RemoveItemBody {
  productId?: unknown;
  variantId?: unknown;
  note?: unknown;
}

/**
 * حذف یک قلم از سفارش پرداخت‌شده توسط مالک — با توضیح اجباری که مشتری در
 * کارت سفارشش می‌بیند؛ مبلغ تناسبی قلم به کیف پول مشتری برمی‌گردد.
 *
 *  POST { productId, variantId|null, note }
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/orders', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;

  let body: RemoveItemBody;
  try {
    body = (await request.json()) as RemoveItemBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  if (typeof body.productId !== 'string' || body.productId === '') {
    return NextResponse.json({ error: 'قلم سفارش مشخص نیست.' }, { status: 400 });
  }
  const variantId =
    typeof body.variantId === 'string' && body.variantId !== '' ? body.variantId : null;

  const result = await removeOrderItem({
    displayId: decodeURIComponent(id),
    productId: body.productId,
    variantId,
    note: typeof body.note === 'string' ? body.note : '',
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await logSystemEvent({
    kind: 'order',
    provider: 'orders',
    action: 'items_remove',
    message: `اقلام سفارش ${decodeURIComponent(id)} حذف شد${result.refunded > 0 ? ` و ${result.refunded.toLocaleString('en-US')} تومان به کیف پول برگشت` : ''}.`,
    actorName: session.name,
    detail: `productId: ${body.productId}${variantId ? `, variantId: ${variantId}` : ''}${typeof body.note === 'string' && body.note.trim() ? ` — توضیح: ${body.note.trim()}` : ''}`,
  });

  return NextResponse.json({
    refunded: result.refunded,
    remainingLines: result.remainingLines,
  });
}
