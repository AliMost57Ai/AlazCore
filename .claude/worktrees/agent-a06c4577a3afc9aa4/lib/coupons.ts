/**
 * Coupon domain logic: admin CRUD plus the checkout-time validation that turns
 * a code into a concrete discount.
 *
 * Server-only — imports lib/db.
 */

import type { Prisma } from '@prisma/client';
import prisma from './db';
import { faJalaliDate } from './format';

/** Direct children of a category — a category rule covers them too. */
async function childCategoryIds(categoryId: string): Promise<string[]> {
  const children = await prisma.category.findMany({
    where: { parentId: categoryId },
    select: { id: true },
  });
  return children.map((child) => child.id);
}

export type CouponType = 'percent' | 'fixed';

export interface CouponDTO {
  id: string;
  code: string;
  type: CouponType;
  /** Percent (0–100) for percent coupons, Toman for fixed ones. */
  value: number;
  isActive: boolean;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  /** The customer this coupon belongs to — null = any signed-in customer. */
  customerId: string | null;
  customerName: string | null;
  /** The product this coupon is restricted to — null = whole order. */
  productId: string | null;
  productName: string | null;
  /** Minimum order total (Toman) required — null = no floor. */
  minPurchaseAmount: number | null;
  /** The category whose products this coupon discounts — null = no category rule. */
  categoryId: string | null;
  categoryName: string | null;
  /** Eligibility: only customers who purchased this product… — null = no rule. */
  purchasedProductId: string | null;
  purchasedProductName: string | null;
  /** …within this window (null = unbounded on that side). */
  purchasedFrom: string | null;
  purchasedTo: string | null;
  /** Purchase-total rule: the comparison operator ('gt'|'lt'|'eq')… */
  purchaseTotalOperator: 'gt' | 'lt' | 'eq' | null;
  /** …and the threshold in Toman — null = no purchase-total rule. */
  purchaseTotalAmount: number | null;
  createdAt: string;
}

function toType(value: string): CouponType {
  return value === 'fixed' ? 'fixed' : 'percent';
}

function toDTO(row: {
  id: string;
  code: string;
  type: string;
  value: number;
  isActive: boolean;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  user: { id: string; name: string } | null;
  product: { id: string; name: string } | null;
  minPurchaseAmount: number | null;
  category: { id: string; name: string } | null;
  purchasedProduct: { id: string; name: string } | null;
  purchasedFrom: Date | null;
  purchasedTo: Date | null;
  purchaseTotalOperator: string | null;
  purchaseTotalAmount: number | null;
  createdAt: Date;
}): CouponDTO {
  return {
    id: row.id,
    code: row.code,
    type: toType(row.type),
    value: row.value,
    isActive: row.isActive,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    customerId: row.user?.id ?? null,
    customerName: row.user?.name ?? null,
    productId: row.product?.id ?? null,
    productName: row.product?.name ?? null,
    minPurchaseAmount: row.minPurchaseAmount,
    categoryId: row.category?.id ?? null,
    categoryName: row.category?.name ?? null,
    purchasedProductId: row.purchasedProduct?.id ?? null,
    purchasedProductName: row.purchasedProduct?.name ?? null,
    purchasedFrom: row.purchasedFrom ? row.purchasedFrom.toISOString() : null,
    purchasedTo: row.purchasedTo ? row.purchasedTo.toISOString() : null,
    purchaseTotalOperator:
      row.purchaseTotalOperator === 'gt' ||
      row.purchaseTotalOperator === 'lt' ||
      row.purchaseTotalOperator === 'eq'
        ? row.purchaseTotalOperator
        : null,
    purchaseTotalAmount: row.purchaseTotalAmount,
    createdAt: row.createdAt.toISOString(),
  };
}

const COUPON_INCLUDE = {
  user: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  purchasedProduct: { select: { id: true, name: true } },
} as const;

export async function listCoupons(): Promise<CouponDTO[]> {
  const rows = await prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
    include: COUPON_INCLUDE,
  });
  return rows.map(toDTO);
}

export interface CouponInput {
  code: string;
  type: CouponType;
  value: number;
  isActive: boolean;
  expiresAt: Date | null;
  maxUses: number | null;
  /** Customer user id — null = usable by any customer. */
  customerId: string | null;
  /** Product id — null = applies to the whole order. */
  productId: string | null;
  /** Minimum order total (Toman) — null = no floor. */
  minPurchaseAmount: number | null;
  /** Category id — null = no category restriction. */
  categoryId: string | null;
  /** Eligibility: product the customer must have purchased — null = no rule. */
  purchasedProductId: string | null;
  /** Purchase window (inclusive bounds) — null = unbounded. */
  purchasedFrom: Date | null;
  purchasedTo: Date | null;
  /** Purchase-total rule: null operator = no rule. */
  purchaseTotalOperator: 'gt' | 'lt' | 'eq' | null;
  /** Purchase-total threshold (Toman) — null = no rule. */
  purchaseTotalAmount: number | null;
}

/** Validates untrusted coupon input — Persian error messages, empty = valid. */
export function validateCouponInput(input: unknown): string[] {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null) {
    return ['داده کد تخفیف نامعتبر است.'];
  }

  const body = input as Record<string, unknown>;

  if (typeof body.code !== 'string' || body.code.trim().length < 3) {
    errors.push('کد تخفیف باید حداقل ۳ نویسه باشد.');
  }

  if (body.type !== 'percent' && body.type !== 'fixed') {
    errors.push('نوع کد تخفیف باید درصدی یا مبلغی باشد.');
  }

  if (
    typeof body.value !== 'number' ||
    !Number.isInteger(body.value) ||
    body.value < 1 ||
    (body.type === 'percent' && body.value > 100)
  ) {
    errors.push(
      body.type === 'percent'
        ? 'درصد تخفیف باید عددی بین ۱ تا ۱۰۰ باشد.'
        : 'مبلغ تخفیف باید عددی مثبت باشد.'
    );
  }

  if (body.maxUses !== null && body.maxUses !== undefined) {
    if (typeof body.maxUses !== 'number' || !Number.isInteger(body.maxUses) || body.maxUses < 1) {
      errors.push('حداکثر تعداد استفاده باید عددی مثبت یا خالی باشد.');
    }
  }

  if (body.customerId !== null && body.customerId !== undefined && body.customerId !== '') {
    if (typeof body.customerId !== 'string') {
      errors.push('مشتری انتخابی نامعتبر است.');
    }
  }

  if (body.productId !== null && body.productId !== undefined && body.productId !== '') {
    if (typeof body.productId !== 'string') {
      errors.push('محصول انتخابی نامعتبر است.');
    }
  }

  if (body.minPurchaseAmount !== null && body.minPurchaseAmount !== undefined) {
    if (
      typeof body.minPurchaseAmount !== 'number' ||
      !Number.isInteger(body.minPurchaseAmount) ||
      body.minPurchaseAmount < 0
    ) {
      errors.push('حداقل مبلغ خرید باید عددی نامنفی باشد.');
    }
  }

  if (body.categoryId !== null && body.categoryId !== undefined && body.categoryId !== '') {
    if (typeof body.categoryId !== 'string') {
      errors.push('دسته انتخابی نامعتبر است.');
    }
  }

  if (
    body.purchasedProductId !== null &&
    body.purchasedProductId !== undefined &&
    body.purchasedProductId !== ''
  ) {
    if (typeof body.purchasedProductId !== 'string') {
      errors.push('محصول خریداری‌شده انتخابی نامعتبر است.');
    }
  }

  const purchasedWindowError =
    'بازه زمانی خرید نامعتبر است — تاریخ شروع باید قبل از تاریخ پایان باشد.';
  const fromDate = toDateOrNull(body.purchasedFrom);
  const toDate = toDateOrNull(body.purchasedTo);
  if (fromDate === 'invalid' || toDate === 'invalid') {
    errors.push('قالب تاریخ بازه خرید نامعتبر است.');
  } else if (fromDate !== null && toDate !== null && fromDate.getTime() > toDate.getTime()) {
    errors.push(purchasedWindowError);
  }

  // Purchase-total rule: operator and threshold must arrive (or vanish) together.
  const hasOperator =
    body.purchaseTotalOperator !== null &&
    body.purchaseTotalOperator !== undefined &&
    body.purchaseTotalOperator !== '';
  const hasAmount = body.purchaseTotalAmount !== null && body.purchaseTotalAmount !== undefined;
  if (hasOperator || hasAmount) {
    if (
      !hasOperator ||
      !hasAmount ||
      (body.purchaseTotalOperator !== 'gt' &&
        body.purchaseTotalOperator !== 'lt' &&
        body.purchaseTotalOperator !== 'eq')
    ) {
      errors.push('قاعده مجموع خریدهای قبلی نامعتبر است — مقایسه و مبلغ را کامل وارد کنید.');
    } else if (
      typeof body.purchaseTotalAmount !== 'number' ||
      !Number.isInteger(body.purchaseTotalAmount) ||
      body.purchaseTotalAmount < 0
    ) {
      errors.push('مبلغ مجموع خریدهای قبلی باید عددی نامنفی باشد.');
    }
  }

  return errors;
}

/** Accepts ISO strings / Date / null; 'invalid' for anything else. */
function toDateOrNull(value: unknown): Date | null | 'invalid' {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'invalid' : parsed;
  }
  return 'invalid';
}

/** Maps the API-shaped input onto the schema's `userId` column. */
function toData(input: CouponInput): Prisma.CouponUncheckedCreateInput {
  const { customerId, ...rest } = input;
  return { ...rest, userId: customerId };
}

export async function createCoupon(input: CouponInput): Promise<CouponDTO> {
  const row = await prisma.coupon.create({
    data: toData(input),
    include: COUPON_INCLUDE,
  });
  return toDTO(row);
}

export async function updateCoupon(id: string, input: CouponInput): Promise<CouponDTO | null> {
  const existing = await prisma.coupon.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return null;
  }
  const row = await prisma.coupon.update({
    where: { id },
    data: toData(input),
    include: COUPON_INCLUDE,
  });
  return toDTO(row);
}

export async function deleteCoupon(id: string): Promise<boolean> {
  const deleted = await prisma.coupon.deleteMany({ where: { id } });
  return deleted.count > 0;
}

export type CouponValidation =
  | { ok: true; coupon: CouponDTO; discount: number }
  | { ok: false; error: string };

/** The order context a coupon is judged against. */
export interface CouponOrderContext {
  amount: number;
  /** The paying customer — customer-assigned coupons must match this id. */
  userId: string | null;
  /** Order line items, for product/category-restricted coupons. */
  items: { productId: string; qty: number; unitPrice: number }[];
}

/**
 * Whether the customer has a PAID order containing `productId` placed in
 * [from, to] — the purchase-history eligibility rule. Orders are matched
 * through their itemsJson line items; paidAt (fallback createdAt) must fall
 * inside the window.
 */
async function customerPurchasedInWindow(
  userId: string,
  productId: string,
  from: Date | null,
  to: Date | null
): Promise<boolean> {
  const orders = await prisma.order.findMany({
    where: {
      userId,
      status: 'paid',
      ...(from || to
        ? {
            AND: [
              ...(from ? [{ paidAt: { gte: from } }] : []),
              ...(to ? [{ paidAt: { lte: to } }] : []),
            ],
          }
        : {}),
    },
    select: { itemsJson: true, paidAt: true, createdAt: true },
  });

  return orders.some((order) => {
    // paidAt is the real purchase moment; createdAt guards legacy rows.
    const when = order.paidAt ?? order.createdAt;
    if (from && when.getTime() < from.getTime()) {
      return false;
    }
    if (to && when.getTime() > to.getTime()) {
      return false;
    }
    try {
      const items: unknown = JSON.parse(order.itemsJson);
      return (
        Array.isArray(items) &&
        items.some(
          (item) =>
            typeof item === 'object' &&
            item !== null &&
            (item as { productId?: unknown }).productId === productId
        )
      );
    } catch {
      return false;
    }
  });
}

/**
 * Checks a code against an order and computes the concrete discount. Coupons
 * can be restricted to one customer and/or one product, and each customer can
 * use a coupon only once (enforced through CouponRedemption, burned on
 * successful payment):
 *
 * - customer-assigned: only that user's orders pass;
 * - min-purchase floor: the whole order amount must clear it;
 * - purchase-history: only buyers of the specified product within the window pass;
 * - product-assigned: eligible only when the order contains the product, and
 *   the discount is computed on that product's line total, not the whole order;
 * - category-assigned: same, for every product in the category (children included);
 * - percent coupons floor, fixed coupons never exceed the discount base.
 */
export async function validateCouponForOrder(
  code: string,
  context: CouponOrderContext
): Promise<CouponValidation> {
  const normalized = code.trim().toUpperCase();
  if (normalized === '') {
    return { ok: false, error: 'کد تخفیف را وارد کنید.' };
  }

  const row = await prisma.coupon.findUnique({
    where: { code: normalized },
    include: COUPON_INCLUDE,
  });
  if (!row || !row.isActive) {
    return { ok: false, error: 'کد تخفیف نامعتبر است.' };
  }

  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'این کد تخفیف منقضی شده است.' };
  }

  if (row.maxUses !== null && row.usedCount >= row.maxUses) {
    return { ok: false, error: 'ظرفیت استفاده از این کد تخفیف تکمیل شده است.' };
  }

  if (row.userId && row.userId !== context.userId) {
    return { ok: false, error: 'این کد تخفیف برای حساب شما فعال نیست.' };
  }

  // Single use per customer — the redemption row is created when the payment
  // goes through, so a pending attempt never blocks a retry.
  if (context.userId) {
    const redeemed = await prisma.couponRedemption.findUnique({
      where: { couponId_userId: { couponId: row.id, userId: context.userId } },
      select: { id: true },
    });
    if (redeemed) {
      return { ok: false, error: 'شما قبلاً از این کد تخفیف استفاده کرده‌اید.' };
    }
  }

  // Minimum purchase floor (Batch K) — judged on the whole order amount.
  if (row.minPurchaseAmount !== null && context.amount < row.minPurchaseAmount) {
    return {
      ok: false,
      error: `حداقل مبلغ خرید برای این کد تخفیف ${row.minPurchaseAmount.toLocaleString('fa-IR')} تومان است.`,
    };
  }

  // Purchase-history eligibility (Batch K): only customers who bought the
  // specified product inside the window may use the code.
  if (row.purchasedProductId) {
    if (!context.userId) {
      return { ok: false, error: 'برای استفاده از این کد تخفیف باید وارد حساب خود شوید.' };
    }
    const bought = await customerPurchasedInWindow(
      context.userId,
      row.purchasedProductId,
      row.purchasedFrom,
      row.purchasedTo
    );
    if (!bought) {
      return {
        ok: false,
        error: `این کد تخفیف فقط برای خریداران محصول «${row.purchasedProduct?.name ?? 'منتخب'}» در بازه تعیین‌شده است.`,
      };
    }
  }

  // Purchase-total eligibility (Batch L): the customer's lifetime PAID total
  // must satisfy gt/lt/eq against the stored threshold.
  if (row.purchaseTotalOperator && row.purchaseTotalAmount !== null) {
    if (!context.userId) {
      return { ok: false, error: 'برای استفاده از این کد تخفیف باید وارد حساب خود شوید.' };
    }
    const paidTotal = await prisma.order
      .aggregate({
        where: { userId: context.userId, status: 'paid' },
        _sum: { amount: true },
      })
      .then((sum) => sum._sum.amount ?? 0);
    const threshold = row.purchaseTotalAmount;
    const passes =
      row.purchaseTotalOperator === 'gt'
        ? paidTotal > threshold
        : row.purchaseTotalOperator === 'lt'
          ? paidTotal < threshold
          : paidTotal === threshold;
    if (!passes) {
      const compare =
        row.purchaseTotalOperator === 'gt'
          ? 'بیشتر از'
          : row.purchaseTotalOperator === 'lt'
            ? 'کمتر از'
            : 'برابر با';
      return {
        ok: false,
        error: `این کد تخفیف فقط برای مشتریانی است که مجموع خریدهای قبلی‌شان ${compare} ${threshold.toLocaleString('fa-IR')} تومان باشد. مجموع خرید شما: ${paidTotal.toLocaleString('fa-IR')} تومان.`,
      };
    }
  }

  // Product-restricted coupons only discount that product's lines.
  let base = context.amount;
  if (row.productId) {
    base = context.items
      .filter((item) => item.productId === row.productId)
      .reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    if (base === 0) {
      return {
        ok: false,
        error: `این کد تخفیف فقط برای محصول «${row.product?.name ?? 'منتخب'}» است.`,
      };
    }
  }

  // Category-restricted coupons (Batch K) discount only the lines whose
  // product is assigned to that category (or one of its children).
  if (row.categoryId) {
    const categoryIds = [row.categoryId, ...(await childCategoryIds(row.categoryId))];
    const joins = await prisma.productCategory.findMany({
      where: { categoryId: { in: categoryIds } },
      select: { productId: true },
    });
    const inCategory = new Set(joins.map((join) => join.productId));
    base = context.items
      .filter((item) => inCategory.has(item.productId))
      .reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    if (base === 0) {
      return {
        ok: false,
        error: `این کد تخفیف فقط برای کالاهای دسته «${row.category?.name ?? 'منتخب'}» است.`,
      };
    }
  }

  const coupon = toDTO(row);
  const discount =
    coupon.type === 'percent'
      ? Math.floor((base * coupon.value) / 100)
      : Math.min(coupon.value, base);

  return { ok: true, coupon, discount };
}

/** Expiry as a Jalali date string for the admin table. */
export function couponExpiryLabel(coupon: CouponDTO): string {
  return coupon.expiresAt ? faJalaliDate(new Date(coupon.expiresAt)) : '—';
}
