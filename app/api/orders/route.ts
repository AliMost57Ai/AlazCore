import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { placeOrder, type OrderItemInput } from '@/lib/shop-orders';

interface OrderBody {
  items?: unknown;
}

/**
 * Places an order from the customer's cart. Prices and stock are resolved
 * server-side from the DB — the client only says which items and how many.
 */
export async function POST(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: OrderBody;
  try {
    body = (await request.json()) as OrderBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const raw = Array.isArray(body.items) ? body.items : [];
  const items: OrderItemInput[] = [];

  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const item = entry as Record<string, unknown>;
    items.push({
      productId: String(item.productId ?? ''),
      variantId: typeof item.variantId === 'string' ? item.variantId : null,
      qty: Number(item.qty),
    });
  }

  const customerName = session.name || 'مشتری';
  const result = await placeOrder(session.sub, customerName, items);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    {
      order: {
        id: result.order.id,
        displayId: result.order.displayId,
        amount: result.order.amount,
        merged: result.merged,
      },
    },
    { status: 201 }
  );
}
