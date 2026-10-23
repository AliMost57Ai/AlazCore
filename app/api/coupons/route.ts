import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@/lib/generated/prisma/client';
import { requireApiMenu } from '@/lib/api-auth';
import { createCoupon, listCoupons, validateCouponInput } from '@/lib/coupons';
import prisma from '@/lib/db';

interface CouponBody {
  code?: unknown;
  type?: unknown;
  value?: unknown;
  isActive?: unknown;
  expiresAt?: unknown;
  maxUses?: unknown;
  customerId?: unknown;
  productId?: unknown;
  minPurchaseAmount?: unknown;
  categoryId?: unknown;
  purchasedProductId?: unknown;
  purchasedFrom?: unknown;
  purchasedTo?: unknown;
  purchaseTotalOperator?: unknown;
  purchaseTotalAmount?: unknown;
}

/** Maps the request body's assignment fields, null when unset. */
function assignment(body: CouponBody): {
  customerId: string | null;
  productId: string | null;
  categoryId: string | null;
  purchasedProductId: string | null;
} {
  const idOrNull = (value: unknown): string | null =>
    typeof value === 'string' && value !== '' ? value : null;
  return {
    customerId: idOrNull(body.customerId),
    productId: idOrNull(body.productId),
    categoryId: idOrNull(body.categoryId),
    purchasedProductId: idOrNull(body.purchasedProductId),
  };
}

/** Optional ISO date → Date; empty/absent → null; malformed → 'invalid'. */
function bodyDate(value: unknown): Date | null | 'invalid' {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'invalid' : parsed;
  }
  return 'invalid';
}

/** 404-shaped 400s when an assigned customer/product/category no longer exists. */
async function checkTargets(
  customerId: string | null,
  productId: string | null,
  categoryId: string | null,
  purchasedProductId: string | null
): Promise<string | null> {
  if (customerId) {
    const customer = await prisma.user.findFirst({
      where: { id: customerId, role: 'customer' },
      select: { id: true },
    });
    if (!customer) {
      return 'مشتری انتخابی یافت نشد.';
    }
  }
  if (productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      return 'محصول انتخابی یافت نشد.';
    }
  }
  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      return 'دسته انتخابی یافت نشد.';
    }
  }
  if (purchasedProductId) {
    const product = await prisma.product.findUnique({
      where: { id: purchasedProductId },
      select: { id: true },
    });
    if (!product) {
      return 'محصول خریداری‌شده انتخابی یافت نشد.';
    }
  }
  return null;
}

/** The targeting fields shared by POST and PATCH. */
function targeting(body: CouponBody): {
  minPurchaseAmount: number | null;
  purchasedFrom: Date | null;
  purchasedTo: Date | null;
  purchaseTotalOperator: 'gt' | 'lt' | 'eq' | null;
  purchaseTotalAmount: number | null;
} {
  const amount = body.minPurchaseAmount;
  const fromDate = bodyDate(body.purchasedFrom);
  const toDate = bodyDate(body.purchasedTo);
  const operator =
    body.purchaseTotalOperator === 'gt' ||
    body.purchaseTotalOperator === 'lt' ||
    body.purchaseTotalOperator === 'eq'
      ? body.purchaseTotalOperator
      : null;
  const totalAmount = body.purchaseTotalAmount;
  return {
    minPurchaseAmount:
      amount === null || amount === undefined || amount === '' ? null : Number(amount),
    purchasedFrom: fromDate === 'invalid' ? null : fromDate,
    purchasedTo: toDate === 'invalid' ? null : toDate,
    purchaseTotalOperator: operator,
    purchaseTotalAmount:
      operator === null || totalAmount === null || totalAmount === undefined
        ? null
        : Number.isInteger(Number(totalAmount)) && Number(totalAmount) >= 0
          ? Number(totalAmount)
          : null,
  };
}

/** GET /api/coupons — the admin coupon list. */
export async function GET() {
  const session = await requireApiMenu('/coupons');
  if (session instanceof NextResponse) {
    return session;
  }

  return NextResponse.json({ coupons: await listCoupons() });
}

/** POST /api/coupons — create a coupon (needs the coupons:add grant). */
export async function POST(request: NextRequest) {
  const session = await requireApiMenu('/coupons', 'add');
  if (session instanceof NextResponse) {
    return session;
  }

  let body: CouponBody;
  try {
    body = (await request.json()) as CouponBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const errors = validateCouponInput(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0], errors }, { status: 400 });
  }

  const { customerId, productId, categoryId, purchasedProductId } = assignment(body);
  const targetError = await checkTargets(customerId, productId, categoryId, purchasedProductId);
  if (targetError) {
    return NextResponse.json({ error: targetError }, { status: 400 });
  }

  try {
    const coupon = await createCoupon({
      code: String(body.code).trim().toUpperCase(),
      type: body.type === 'fixed' ? 'fixed' : 'percent',
      value: Number(body.value),
      isActive: body.isActive === true,
      expiresAt:
        typeof body.expiresAt === 'string' && body.expiresAt !== ''
          ? new Date(body.expiresAt)
          : null,
      maxUses:
        body.maxUses === null || body.maxUses === undefined || body.maxUses === ''
          ? null
          : Number(body.maxUses),
      customerId,
      productId,
      ...targeting(body),
      categoryId,
      purchasedProductId,
    });
    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'این کد تخفیف قبلاً ثبت شده است.' }, { status: 409 });
    }
    throw error;
  }
}
