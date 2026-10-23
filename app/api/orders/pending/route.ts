import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import prisma from '@/lib/db';
import { parseItems } from '@/lib/shop-orders';

/**
 * The customer's unpaid order — the one that doubles as their active basket.
 *
 *  GET                              → the order (displayId/amount/items) or null
 *  DELETE ?productId=…&variantId=…  → removes one line from it: stock goes
 *    back, the total is recomputed and the order disappears when its last
 *    line is removed.
 */
export async function GET() {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const order = await prisma.order.findFirst({
    where: { userId: session.sub, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });

  if (!order) {
    return NextResponse.json({ order: null }, { headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json(
    {
      order: {
        displayId: order.displayId,
        amount: order.amount,
        items: parseItems(order.itemsJson),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function DELETE(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const params = request.nextUrl.searchParams;
  const productId = params.get('productId') ?? '';
  const variantId = params.get('variantId') || null;
  if (!productId) {
    return NextResponse.json({ error: 'ردیف سبد نامعتبر است.' }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { userId: session.sub, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });
  if (!order) {
    return NextResponse.json({ error: 'سبد خریدی برای حذف وجود ندارد.' }, { status: 404 });
  }

  const items = parseItems(order.itemsJson);
  const line = items.find((item) => item.productId === productId && item.variantId === variantId);
  if (!line) {
    return NextResponse.json({ error: 'این ردیف در سبد شما نیست.' }, { status: 404 });
  }

  const rest = items.filter((item) => item !== line);

  await prisma.$transaction(async (tx) => {
    // Stock the order took comes back.
    if (line.variantId) {
      await tx.productVariant.update({
        where: { id: line.variantId },
        data: { qty: { increment: line.qty } },
      });
    } else {
      await tx.product.update({
        where: { id: line.productId },
        data: { qty: { increment: line.qty } },
      });
    }

    if (rest.length === 0) {
      await tx.order.delete({ where: { id: order.id } });
    } else {
      await tx.order.update({
        where: { id: order.id },
        data: {
          itemsJson: JSON.stringify(rest),
          amount: rest.reduce((sum, item) => sum + item.unitPrice * item.qty, 0),
        },
      });
    }
  });

  return NextResponse.json({
    order:
      rest.length === 0
        ? null
        : {
            displayId: order.displayId,
            amount: rest.reduce((sum, item) => sum + item.unitPrice * item.qty, 0),
            items: rest,
          },
  });
}
