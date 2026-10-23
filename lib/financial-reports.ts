/**
 * گزارشات مالی بک‌آفیس فروشگاه — لایه سرویس هر چهار گزارش منوی «گزارشات مالی».
 *
 * معناشناسی پول عیناً همان lib/accounting.ts است تا عدد گزارش با صفحه حسابداری
 * هرگز نخواند: قابل پرداخت = amount − discountAmount + shippingCost، پرداخت
 * آنلاین = تراکنش verified با kind='wallet_charge' وابسته به سفارش، فروش مؤثر
 * = سفارش‌های غیر pending/cancelled، و فقط سفارش‌های حساب‌دار (userId) — ردیف‌های
 * دموی seed در هیچ گزارش مالی نمی‌آیند.
 *
 *  ۱. financialSummary — خلاصه مالی دوره (سطر روزانه/ماهانه)
 *  ۲. couponReport      — عملکرد کدهای تخفیف
 *  ۳. commissionReport  — کارمزد AlazCore (ماهانه)
 *  ۴. cashFlowReport    — جریان نقدی روزانه (دفتر درگاه + دفتر کیف پول)
 *
 * بازه تاریخ روی createdAt با مرزهای محلی روز است؛ برچسب دوره‌ها از خود
 * Order.date (شمسی پیش‌فرمت‌شده) و برای دفتر پول از faJalaliDate می‌آید.
 */

import type { Prisma } from './generated/prisma/client';
import { currentDomain, getLicense } from './core-license';
import prisma from './db';
import { faJalaliDate, fromFaDigits, jalaliMonthName, toFaDigits } from './format';

/** بازه تاریخ صفحات — از فرم GET، رشته YYYY-MM-DD (خروجی PersianDateTimePicker). */
export interface ReportRange {
  from?: string;
  to?: string;
}

function parseRangeBound(value: string | undefined, endOfDay: boolean): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

/** فیلتر createdAt از بازه فرم — مرز «از» ابتدای روز و «تا» انتهای روز. */
export function createdAtFilter({ from, to }: ReportRange): Prisma.DateTimeFilter {
  const range: Prisma.DateTimeFilter = {};
  const gte = parseRangeBound(from, false);
  const lte = parseRangeBound(to, true);
  if (gte) {
    range.gte = gte;
  }
  if (lte) {
    range.lte = lte;
  }
  return range;
}

/** خالی بودن فیلتر بازه — برای پیام «حذف فیلترها» و خروجی اکسل. */
export function hasRange(range: ReportRange): boolean {
  return Boolean(range.from || range.to);
}

/** شرط سفارش‌های حساب‌دار (خارج از دموی seed) با بازه اختیاری. */
function accountOrderWhere(range: ReportRange): Prisma.OrderWhereInput {
  return { userId: { not: null }, createdAt: createdAtFilter(range) };
}

/** کلید دوره روزانه/ماهانه از برچسب شمسی سفارش — با سال، تا مرز سال درست بماند. */
function periodKey(jalaliLabel: string, createdAt: Date, bucket: 'day' | 'month'): string {
  const normalized = jalaliLabel ? fromFaDigits(jalaliLabel) : '';
  const match = normalized.match(/^(\d{4})\/(\d{2})(?:\/(\d{2}))?/);
  if (match) {
    return bucket === 'day'
      ? `${match[1]}/${match[2]}/${match[3] ?? '01'}`
      : `${match[1]}/${match[2]}`;
  }
  // ردیف‌های بدون برچسب — از تاریخ واقعی می‌سازیم.
  const key = faJalaliDate(createdAt);
  return bucket === 'day' ? key : key.slice(0, 7);
}

/** '۱۴۰۴/۰۷' → «مهر ۱۴۰۴» — برچسب خوانای دوره ماهانه. */
function monthLabel(key: string): string {
  const [year, month] = key.split('/');
  return `${jalaliMonthName(Number(fromFaDigits(month)))} ${toFaDigits(year)}`;
}

/** درصد پورسانت لایسنس — null یعنی بک‌آفیس کور در دسترس نبود. */
async function licenseCommissionPercent(): Promise<number | null> {
  const license = await getLicense(await currentDomain());
  if (!license?.ok) {
    return null;
  }
  return typeof license.commissionPercent === 'number' ? license.commissionPercent : 0;
}

/* ── ۱) خلاصه مالی دوره ─────────────────────────────────────────────────── */

export type SummaryBucket = 'day' | 'month';
export type SummarySalesFilter = 'settled' | 'all' | 'cancelled';
export type SummaryDeliveryFilter = 'all' | 'pickup' | 'shipping';

export interface SummaryFilters extends ReportRange {
  bucket: SummaryBucket;
  sales: SummarySalesFilter;
  delivery: SummaryDeliveryFilter;
}

export interface SummaryRow {
  /** کلید مرتب‌سازی دوره — '۱۴۰۴/۰۷/۱۲' یا '۱۴۰۴/۰۷'. */
  key: string;
  label: string;
  orders: number;
  /** جمع قیمت لیست (fallback حسابداری برای ردیف‌های قدیمی). */
  grossList: number;
  /** تخفیف کالا + تخفیف کد. */
  discounts: number;
  shipping: number;
  /** فروش خالص — همان amount. */
  net: number;
  /** پول وصول‌شده سفارش‌های پرداخت‌شده. */
  collected: number;
  /** قابل پرداخت سفارش‌های پرداخت‌نشده (در انتظار/پس‌کرایه). */
  outstanding: number;
  commission: number;
  ownerNet: number;
}

export interface SummaryResult {
  rows: SummaryRow[];
  totals: Omit<SummaryRow, 'key' | 'label'>;
  /** درصد پورسانت لحاظ‌شده — null یعنی لایسنس در دسترس نبود. */
  commissionPercent: number | null;
}

export function normalizeSummaryFilters(
  params: Record<string, string | undefined>
): SummaryFilters {
  const bucket = params.bucket === 'month' ? 'month' : 'day';
  const sales = params.sales === 'all' || params.sales === 'cancelled' ? params.sales : 'settled';
  const delivery =
    params.delivery === 'pickup' || params.delivery === 'shipping' ? params.delivery : 'all';
  return { bucket, sales, delivery, from: params.from, to: params.to };
}

export async function financialSummary(filters: SummaryFilters): Promise<SummaryResult> {
  const where = accountOrderWhere(filters);
  if (filters.sales === 'settled') {
    where.status = { notIn: ['pending', 'cancelled'] };
  } else if (filters.sales === 'cancelled') {
    where.status = 'cancelled';
  }
  if (filters.delivery === 'pickup') {
    where.pickupSlotId = { not: null };
  } else if (filters.delivery === 'shipping') {
    where.pickupSlotId = null;
  }

  const [rows, percent] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        date: true,
        createdAt: true,
        amount: true,
        baseAmount: true,
        discountAmount: true,
        shippingCost: true,
        status: true,
        paidAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    licenseCommissionPercent(),
  ]);

  const buckets = new Map<string, SummaryRow>();
  for (const row of rows) {
    const key = periodKey(row.date, row.createdAt, filters.bucket);
    const base = row.baseAmount >= row.amount ? row.baseAmount : row.amount;
    const payable = row.amount - row.discountAmount + row.shippingCost;
    const collected = row.paidAt ? payable : 0;
    const outstanding = !row.paidAt && row.status !== 'cancelled' ? payable : 0;

    const bucketRow =
      buckets.get(key) ??
      ({
        key,
        label: filters.bucket === 'month' ? monthLabel(key) : toFaDigits(key),
        orders: 0,
        grossList: 0,
        discounts: 0,
        shipping: 0,
        net: 0,
        collected: 0,
        outstanding: 0,
        commission: 0,
        ownerNet: 0,
      } satisfies SummaryRow);
    bucketRow.orders += 1;
    bucketRow.grossList += base;
    bucketRow.discounts += base - row.amount + row.discountAmount;
    bucketRow.shipping += row.shippingCost;
    bucketRow.net += row.amount;
    bucketRow.collected += collected;
    bucketRow.outstanding += outstanding;
    buckets.set(key, bucketRow);
  }

  const resolvedPercent = percent ?? 0;
  const summaryRows = [...buckets.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  for (const row of summaryRows) {
    row.commission = Math.round((row.net * resolvedPercent) / 100);
    row.ownerNet = row.net - row.commission;
  }

  const totals = summaryRows.reduce(
    (sum, row) => ({
      orders: sum.orders + row.orders,
      grossList: sum.grossList + row.grossList,
      discounts: sum.discounts + row.discounts,
      shipping: sum.shipping + row.shipping,
      net: sum.net + row.net,
      collected: sum.collected + row.collected,
      outstanding: sum.outstanding + row.outstanding,
      commission: sum.commission + row.commission,
      ownerNet: sum.ownerNet + row.ownerNet,
    }),
    {
      orders: 0,
      grossList: 0,
      discounts: 0,
      shipping: 0,
      net: 0,
      collected: 0,
      outstanding: 0,
      commission: 0,
      ownerNet: 0,
    }
  );

  return { rows: summaryRows, totals, commissionPercent: percent };
}

/* ── ۲) عملکرد کدهای تخفیف ──────────────────────────────────────────────── */

export interface CouponReportRow {
  code: string;
  /** وضعیت کد از جدول کوپن — null یعنی کد دیگر وجود ندارد (فقط در سفارش‌ها). */
  isActive: boolean | null;
  isExpired: boolean;
  /** رستمی یکتا (ledger CouponRedemption). */
  uses: number;
  orders: number;
  customers: number;
  /** فروش سفارش‌های دارای این کد (amount). */
  sales: number;
  discount: number;
  /** سهم تخفیف از فروش — درصد با یک رقم اعشار. */
  share: number;
  lastUsed: string | null;
}

export interface CouponReportResult {
  rows: CouponReportRow[];
  totals: { orders: number; sales: number; discount: number };
}

export async function couponReport(range: ReportRange): Promise<CouponReportResult> {
  const where = accountOrderWhere(range);
  where.couponCode = { not: null };

  const [orders, redemptions, coupons] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        couponCode: true,
        amount: true,
        discountAmount: true,
        userId: true,
        createdAt: true,
      },
    }),
    prisma.couponRedemption.groupBy({
      by: ['couponId'],
      _count: { _all: true },
      where: { createdAt: createdAtFilter(range) },
    }),
    prisma.coupon.findMany({ select: { id: true, code: true, isActive: true, expiresAt: true } }),
  ]);

  const redemptionsByCoupon = new Map(redemptions.map((row) => [row.couponId, row._count._all]));
  const couponByCode = new Map(coupons.map((coupon) => [coupon.code, coupon]));
  const redemptionIdByCode = new Map(coupons.map((coupon) => [coupon.id, coupon.code]));

  interface Aggregate {
    orders: number;
    customers: Set<string>;
    sales: number;
    discount: number;
    lastUsed: Date;
  }
  const byCode = new Map<string, Aggregate>();
  for (const order of orders) {
    const code = order.couponCode;
    if (!code) {
      continue;
    }
    const bucket =
      byCode.get(code) ??
      ({
        orders: 0,
        customers: new Set<string>(),
        sales: 0,
        discount: 0,
        lastUsed: order.createdAt,
      } as Aggregate);
    bucket.orders += 1;
    if (order.userId) {
      bucket.customers.add(order.userId);
    }
    bucket.sales += order.amount;
    bucket.discount += order.discountAmount;
    if (order.createdAt > bucket.lastUsed) {
      bucket.lastUsed = order.createdAt;
    }
    byCode.set(code, bucket);
  }

  // رستمی کوپن‌هایی که سفارشی در این بازه ندارند هم باید دیده شوند —
  // ledger رستمی مرجع «استفاده» است.
  for (const couponId of redemptionsByCoupon.keys()) {
    const code = redemptionIdByCode.get(couponId);
    if (code && !byCode.has(code)) {
      byCode.set(code, {
        orders: 0,
        customers: new Set<string>(),
        sales: 0,
        discount: 0,
        lastUsed: new Date(0),
      });
    }
  }

  const now = Date.now();
  const rows: CouponReportRow[] = [...byCode.entries()]
    .map(([code, bucket]) => {
      const coupon = couponByCode.get(code) ?? null;
      const uses = coupon ? (redemptionsByCoupon.get(coupon.id) ?? 0) : 0;
      return {
        code,
        isActive: coupon ? coupon.isActive : null,
        isExpired: coupon?.expiresAt ? coupon.expiresAt.getTime() < now : false,
        uses,
        orders: bucket.orders,
        customers: bucket.customers.size,
        sales: bucket.sales,
        discount: bucket.discount,
        share: bucket.sales > 0 ? Math.round((bucket.discount / bucket.sales) * 1000) / 10 : 0,
        lastUsed: bucket.lastUsed.getTime() > 0 ? faJalaliDate(bucket.lastUsed) : null,
      };
    })
    .sort((a, b) => b.discount - a.discount || b.orders - a.orders);

  const totals = rows.reduce(
    (sum, row) => ({
      orders: sum.orders + row.orders,
      sales: sum.sales + row.sales,
      discount: sum.discount + row.discount,
    }),
    { orders: 0, sales: 0, discount: 0 }
  );

  return { rows, totals };
}

/* ── ۳) کارمزد AlazCore ─────────────────────────────────────────────────── */

export interface CommissionRow {
  key: string;
  label: string;
  orders: number;
  sales: number;
  commission: number;
  ownerNet: number;
}

export interface CommissionResult {
  rows: CommissionRow[];
  totals: { orders: number; sales: number; commission: number; ownerNet: number };
  /** درصد پورسانت — null یعنی لایسنس خوانده نشد (کارمزد صفر فرض شده). */
  percent: number | null;
}

export async function commissionReport(range: ReportRange): Promise<CommissionResult> {
  const where = accountOrderWhere(range);
  where.status = { notIn: ['pending', 'cancelled'] };

  const [orders, percent] = await Promise.all([
    prisma.order.findMany({
      where,
      select: { date: true, createdAt: true, amount: true },
      orderBy: { createdAt: 'asc' },
    }),
    licenseCommissionPercent(),
  ]);

  const buckets = new Map<string, CommissionRow>();
  for (const order of orders) {
    const key = periodKey(order.date, order.createdAt, 'month');
    const bucket =
      buckets.get(key) ??
      ({
        key,
        label: monthLabel(key),
        orders: 0,
        sales: 0,
        commission: 0,
        ownerNet: 0,
      } as CommissionRow);
    bucket.orders += 1;
    bucket.sales += order.amount;
    buckets.set(key, bucket);
  }

  const resolvedPercent = percent ?? 0;
  const rows = [...buckets.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  for (const row of rows) {
    row.commission = Math.round((row.sales * resolvedPercent) / 100);
    row.ownerNet = row.sales - row.commission;
  }

  const totals = rows.reduce(
    (sum, row) => ({
      orders: sum.orders + row.orders,
      sales: sum.sales + row.sales,
      commission: sum.commission + row.commission,
      ownerNet: sum.ownerNet + row.ownerNet,
    }),
    { orders: 0, sales: 0, commission: 0, ownerNet: 0 }
  );

  return { rows, totals, percent };
}

/* ── ۴) جریان نقدی روزانه ───────────────────────────────────────────────── */

export interface CashFlowRow {
  key: string;
  label: string;
  /** دریافت تأییدشده درگاه برای سفارش‌ها. */
  gatewayOrders: number;
  /** دریافت تأییدشده درگاه برای شارژ کیف پول. */
  gatewayTopUp: number;
  /** بدهکار شدن کیف پول برای پرداخت سفارش. */
  walletPaid: number;
  /** بازگشت پول به کیف پول (لغو سفارش پرداخت‌شده). */
  walletRefund: number;
  /** تنظیم دستی ادمین — می‌تواند منفی باشد. */
  walletAdjust: number;
  /** جمع ورودی نقدی واقعی دوره. */
  cashIn: number;
}

export interface CashFlowResult {
  rows: CashFlowRow[];
  totals: Omit<CashFlowRow, 'key' | 'label'>;
}

function dayKeyOf(date: Date): string {
  return faJalaliDate(date);
}

function emptyCashRow(key: string): CashFlowRow {
  return {
    key,
    label: toFaDigits(key),
    gatewayOrders: 0,
    gatewayTopUp: 0,
    walletPaid: 0,
    walletRefund: 0,
    walletAdjust: 0,
    cashIn: 0,
  };
}

export async function cashFlowReport(range: ReportRange): Promise<CashFlowResult> {
  const createdAt = createdAtFilter(range);

  const [gateway, wallet] = await Promise.all([
    prisma.onlinePaymentTransaction.findMany({
      where: { state: 'verified', createdAt },
      select: { kind: true, amount: true, createdAt: true },
    }),
    prisma.walletTransaction.findMany({
      where: { createdAt },
      select: { type: true, amount: true, createdAt: true },
    }),
  ]);

  const buckets = new Map<string, CashFlowRow>();
  const rowOf = (date: Date): CashFlowRow => {
    const key = dayKeyOf(date);
    const row = buckets.get(key) ?? emptyCashRow(key);
    buckets.set(key, row);
    return row;
  };

  for (const movement of gateway) {
    const row = rowOf(movement.createdAt);
    if (movement.kind === 'order_payment') {
      row.gatewayOrders += movement.amount;
    } else {
      row.gatewayTopUp += movement.amount;
    }
  }
  for (const movement of wallet) {
    const row = rowOf(movement.createdAt);
    if (movement.type === 'order_payment') {
      row.walletPaid += Math.abs(movement.amount);
    } else if (movement.type === 'refund') {
      row.walletRefund += movement.amount;
    } else if (movement.type === 'admin_adjust') {
      row.walletAdjust += movement.amount;
    }
    // 'charge' در دفتر کیف پول آینه همان شارژ درگاه است — ستون شارژ از
    // دفتر درگاه می‌آید تا پول نقدی دوبار شمرده نشود.
  }
  for (const row of buckets.values()) {
    row.cashIn = row.gatewayOrders + row.gatewayTopUp;
  }

  const rows = [...buckets.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  const totals = rows.reduce(
    (sum, row) => ({
      gatewayOrders: sum.gatewayOrders + row.gatewayOrders,
      gatewayTopUp: sum.gatewayTopUp + row.gatewayTopUp,
      walletPaid: sum.walletPaid + row.walletPaid,
      walletRefund: sum.walletRefund + row.walletRefund,
      walletAdjust: sum.walletAdjust + row.walletAdjust,
      cashIn: sum.cashIn + row.cashIn,
    }),
    {
      gatewayOrders: 0,
      gatewayTopUp: 0,
      walletPaid: 0,
      walletRefund: 0,
      walletAdjust: 0,
      cashIn: 0,
    }
  );

  return { rows, totals };
}
