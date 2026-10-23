import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { validateCouponForOrder } from '@/lib/coupons';
import prisma from '@/lib/db';
import { parseItems } from '@/lib/shop-orders';
import { ensureSiteContext } from '@/lib/site-context';

interface ValidateBody {
  code?: unknown;
  orderId?: unknown;
}

/**
 * Pre-flight coupon check for the checkout page: does this code knock anything
 * off THIS order? Returns the concrete discount so the customer sees the
 * payable amount before committing. Applies nothing — the coupon is only
 * burned when the payment goes through.
 */
export async function POST(request: NextRequest) {
  await ensureSiteContext();
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: ValidateBody;
  try {
    body = (await request.json()) as ValidateBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  if (typeof body.code !== 'string' || typeof body.orderId !== 'string') {
    return NextResponse.json({ error: 'کد تخفیف و سفارش را مشخص کنید.' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: body.orderId } });
  if (!order || order.userId !== session.sub || order.status !== 'pending') {
    return NextResponse.json({ error: 'سفارش یافت نشد.' }, { status: 404 });
  }

  const validation = await validateCouponForOrder(body.code, {
    amount: order.amount,
    userId: session.sub,
    items: parseItems(order.itemsJson),
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  return NextResponse.json({
    code: validation.coupon.code,
    discount: validation.discount,
    payable: order.amount - validation.discount,
  });
}
