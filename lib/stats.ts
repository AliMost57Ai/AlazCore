/**
 * Dashboard statistics: values are computed from real DB rows.
 *
 * Deltas and 12-point sparkline trends remain static demo hints — the seed has
 * no real history to compute month-over-month changes from. The numbers the
 * user reads (value fields) are live; the arrows and sparklines are illustrative
 * until real order history accumulates.
 */

import prisma from './db';
import { faNumber, jalaliMonthName, toJalali } from './format';
import { parseOrderItems } from './orders';
import { stockAlertCounts } from './stock';

/** وضعیت‌های فروش واقعی — مبنای روند درآمد و تفکیک فروش (pending/لغو حذف). */
const SALE_STATUSES = ['paid', 'boxing', 'posted', 'shipped', 'delivered'];

export interface StatTile {
  key: string;
  label: string;
  value: number;
  /** Percent change against the previous period — static demo hint, see above. */
  delta: number;
  /** Whether a rising number is a good thing — drives the delta colour. */
  upIsGood: boolean;
  format: 'currency' | 'number' | 'percent';
  icon: 'credit-card' | 'shopping-cart' | 'users' | 'trending-up';
  /** 12-point sparkline — static demo hint, see above. */
  trend: number[];
}

export interface SeriesPoint {
  label: string;
  value: number;
  /** توضیح اختیاری فقط برای tooltip/جدول شنیداری (مثلاً بازه تاریخ هفته). */
  hint?: string;
}

const TILES: Omit<StatTile, 'value'>[] = [
  {
    key: 'revenue',
    label: 'درآمد این ماه',
    delta: 12.4,
    upIsGood: true,
    format: 'currency',
    icon: 'credit-card',
    trend: [22, 25, 24, 29, 31, 30, 35, 38, 36, 41, 44, 48],
  },
  {
    key: 'orders',
    label: 'سفارش‌های ثبت‌شده',
    delta: 8.1,
    upIsGood: true,
    format: 'number',
    icon: 'shopping-cart',
    trend: [40, 38, 44, 42, 47, 45, 51, 49, 55, 53, 58, 61],
  },
  {
    key: 'customers',
    label: 'مشتریان فعال',
    delta: 3.6,
    upIsGood: true,
    format: 'number',
    icon: 'users',
    trend: [60, 61, 63, 62, 64, 66, 65, 68, 70, 69, 72, 74],
  },
  {
    key: 'churn',
    label: 'نرخ ریزش',
    delta: -0.6,
    upIsGood: false,
    format: 'percent',
    icon: 'trending-up',
    trend: [5.1, 4.8, 4.6, 4.4, 4.1, 3.9, 3.7, 3.5, 3.3, 3.1, 2.9, 2.8],
  },
];

/** Jalali month order — the revenue series is chronological. */
const MONTH_ORDER = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export async function getStatTiles(): Promise<StatTile[]> {
  const [revenueSum, orderCount, customerCount, churnRow] = await Promise.all([
    prisma.order.aggregate({ _sum: { amount: true } }),
    prisma.order.count(),
    prisma.user.count({ where: { role: 'customer' } }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const statusCount = (status: string): number =>
    churnRow.find((row) => row.status === status)?._count._all ?? 0;

  const cancelled = statusCount('cancelled');
  const pending = statusCount('pending');
  // Churn = orders that did not convert (cancelled + still pending) / total.
  const churn = orderCount > 0 ? ((cancelled + pending) / orderCount) * 100 : 0;

  const values: Record<string, number> = {
    revenue: revenueSum._sum.amount ?? 0,
    orders: orderCount,
    customers: customerCount,
    churn: Math.round(churn * 10) / 10,
  };

  return TILES.map((tile) => ({ ...tile, value: values[tile.key] ?? 0 }));
}

/**
 * درآمد ماهانه به تفکیک سال شمسی — فقط فروش واقعی (پرداخت‌شده به بعد) بر
 * مبنای paidAt. هر سالِ دارای فروش، فریم کامل ۱۲ ماه را می‌گیرد (ماه خالی =
 * صفر) تا انتخاب سال در داشبورد نموداری هم‌قواره بدهد.
 */
export interface MonthlyRevenue {
  /** سال‌های شمسی دارای فروش — نزولی (اولی = آخرین سال). */
  years: number[];
  /** کلید = سال شمسی؛ فریم ۱۲ ماه فروردین…اسفند. */
  byYear: Record<string, SeriesPoint[]>;
  /** رشد ماه آخرِ دارای داده نسبت به ماه قبلش، در صد — ۰ بدون جفت. */
  growth: number;
}

export async function getMonthlyRevenue(): Promise<MonthlyRevenue> {
  const rows = await prisma.order.findMany({
    where: { status: { in: SALE_STATUSES } },
    select: { amount: true, paidAt: true, createdAt: true },
  });

  const sums = new Map<string, number>();
  const years = new Set<number>();
  for (const row of rows) {
    const anchor = row.paidAt ?? row.createdAt;
    const [jYear, jMonth] = toJalali(anchor);
    years.add(jYear);
    const key = `${jYear}:${jMonth}`;
    sums.set(key, (sums.get(key) ?? 0) + row.amount);
  }

  const sortedYears = [...years].sort((a, b) => b - a);
  const byYear: Record<string, SeriesPoint[]> = {};
  for (const year of sortedYears) {
    byYear[String(year)] = MONTH_ORDER.map((label, index) => ({
      label,
      value: sums.get(`${year}:${index + 1}`) ?? 0,
    }));
  }

  // رشد ماهانه — از انتهای سال آخر، دو ماهِ دارای داده پشت‌سرهم مقایسه می‌شوند.
  let growth = 0;
  const latest = byYear[String(sortedYears[0])] ?? [];
  const withData = latest.reduce<number[]>((acc, point, index) => {
    if (point.value > 0) {
      acc.push(index);
    }
    return acc;
  }, []);
  if (withData.length >= 2) {
    const previous = latest[withData[withData.length - 2]].value;
    const current = latest[withData[withData.length - 1]].value;
    if (previous > 0) {
      growth = Math.round(((current - previous) / previous) * 1000) / 10;
    }
  }

  return { years: sortedYears, byYear, growth };
}

/** Order counts per category, sorted descending so the bars read as a ranking. */
export async function getCategorySeries(): Promise<SeriesPoint[]> {
  const rows = await prisma.order.groupBy({
    by: ['category'],
    _count: { _all: true },
  });

  return rows
    .map((row) => ({ label: row.category, value: row._count._all }))
    .sort((a, b) => b.value - a.value);
}

/** روزِ شمسی یک تاریخ — برچسب «۱۵ مهر» برای محور روند روزانه. */
function jalaliDayLabel(date: Date): string {
  const [, month, day] = toJalali(date);
  return `${faNumber(day)} ${jalaliMonthName(month)}`;
}

/** شناسه باکت روز — کلید یکتای Map بر مبنای تاریخ محلی. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** شناسه باکت هفته — شنبه‌آغاز؛ getDay: شنبه=۶ پس آفست (day+1)%7. */
function weekStart(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
  return start;
}

/** روند روزانه — ۳۰ روز گذشته، مبلغ فروش واقعی بر مبنای تاریخ پرداخت. */
export async function getRevenueDailySeries(): Promise<SeriesPoint[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const since = new Date(today);
  since.setDate(since.getDate() - 29);

  const rows = await prisma.order.findMany({
    where: { status: { in: SALE_STATUSES }, createdAt: { gte: since } },
    select: { amount: true, paidAt: true, createdAt: true },
  });

  const labels = new Map<string, string>();
  for (let index = 0; index < 30; index += 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - index);
    labels.set(dayKey(day), jalaliDayLabel(day));
  }
  const sums = new Map<string, number>();
  for (const row of rows) {
    const anchor = row.paidAt ?? row.createdAt;
    const key = dayKey(anchor);
    if (labels.has(key)) {
      sums.set(key, (sums.get(key) ?? 0) + row.amount);
    }
  }
  return [...labels.entries()]
    .reverse()
    .map(([key, label]) => ({ label, value: sums.get(key) ?? 0 }));
}

/** روند هفتگی — ۱۲ هفته گذشته (شنبه‌آغاز)، مبلغ فروش واقعی. برچسب ترتیبی
 *  فارسی (هفته اول…) و بازه تاریخ هر هفته در hint برای tooltip. */
export async function getRevenueWeeklySeries(): Promise<SeriesPoint[]> {
  const WEEK_ORDINALS = [
    'اول',
    'دوم',
    'سوم',
    'چهارم',
    'پنجم',
    'ششم',
    'هفتم',
    'هشتم',
    'نهم',
    'دهم',
    'یازدهم',
    'دوازدهم',
  ];
  const today = weekStart(new Date());
  const since = new Date(today);
  since.setDate(since.getDate() - 77); // ۱۲ هفته کامل

  const rows = await prisma.order.findMany({
    where: { status: { in: SALE_STATUSES }, createdAt: { gte: since } },
    select: { amount: true, paidAt: true, createdAt: true },
  });

  // باکت‌ها قدیمی → جدید: هفته اول = قدیمی‌ترین هفته پنجره.
  const buckets: { key: string; label: string; hint: string }[] = [];
  for (let index = 11; index >= 0; index -= 1) {
    const start = new Date(today);
    start.setDate(start.getDate() - index * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    buckets.push({
      key: dayKey(start),
      label: `هفته ${WEEK_ORDINALS[11 - index]}`,
      hint: `${jalaliDayLabel(start)} تا ${jalaliDayLabel(end)}`,
    });
  }
  const sums = new Map<string, number>();
  for (const row of rows) {
    const anchor = weekStart(row.paidAt ?? row.createdAt);
    const key = dayKey(anchor);
    if (buckets.some((bucket) => bucket.key === key)) {
      sums.set(key, (sums.get(key) ?? 0) + row.amount);
    }
  }
  return buckets.map((bucket) => ({
    label: bucket.label,
    hint: bucket.hint,
    value: sums.get(bucket.key) ?? 0,
  }));
}

/**
 * تفکیک فروش داشبورد — سه نگاه به یک منبع (سفارش‌های پرداخت‌شده به بعد):
 * دسته‌بندی کالا (جمع خطوط اقلام بر اساس دسته محصول)، تحویل حضوری (بر اساس
 * نقطه مراجعه) و انواع ارسال (بر اساس روش ارسال فاکتور).
 */
export interface SalesBreakdown {
  categories: SeriesPoint[];
  pickupLocations: SeriesPoint[];
  deliveryMethods: SeriesPoint[];
}

const UNCATEGORIZED = 'بدون دسته‌بندی';

export async function getSalesBreakdown(): Promise<SalesBreakdown> {
  const rows = await prisma.order.findMany({
    where: { status: { in: SALE_STATUSES } },
    select: {
      itemsJson: true,
      amount: true,
      pickupLocationId: true,
      pickupSlotId: true,
      deliveryMethod: true,
    },
  });

  // نقشه کالا → دسته (اولین دسته محصول) — یک کوئری دسته‌ای.
  const productIds = new Set<string>();
  const linesByOrder: { itemsJson: string }[] = rows;
  for (const row of linesByOrder) {
    for (const line of parseOrderItems(row.itemsJson)) {
      if (line.productId) {
        productIds.add(line.productId);
      }
    }
  }
  const products = productIds.size
    ? await prisma.product.findMany({
        where: { id: { in: [...productIds] } },
        select: {
          id: true,
          categories: { select: { category: { select: { name: true } } } },
        },
      })
    : [];
  const categoryByProduct = new Map<string, string>();
  for (const product of products) {
    categoryByProduct.set(product.id, product.categories[0]?.category.name ?? UNCATEGORIZED);
  }

  // نام نقاط تحویل حضوری — یک کوئری دسته‌ای.
  const locationIds = [
    ...new Set(rows.map((row) => row.pickupLocationId).filter((id): id is string => !!id)),
  ];
  const locations = locationIds.length
    ? await prisma.pickupLocation.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, title: true },
      })
    : [];
  const titleByLocation = new Map(locations.map((row) => [row.id, row.title]));

  const categories = new Map<string, number>();
  const pickupLocations = new Map<string, number>();
  const deliveryMethods = new Map<string, number>();
  for (const row of rows) {
    // فروش دسته‌ای = جمع خطوط اقلام (تعداد × قیمت واحدِ فاکتورشده).
    for (const line of parseOrderItems(row.itemsJson)) {
      const label = (line.productId && categoryByProduct.get(line.productId)) || UNCATEGORIZED;
      categories.set(label, (categories.get(label) ?? 0) + line.qty * line.unitPrice);
    }
    const isPickup = Boolean(row.pickupSlotId);
    if (isPickup) {
      const label = row.pickupLocationId
        ? (titleByLocation.get(row.pickupLocationId) ?? 'نقطه حضوری')
        : 'نقطه حضوری';
      pickupLocations.set(label, (pickupLocations.get(label) ?? 0) + row.amount);
    }
    const methodLabel = isPickup ? 'تحویل حضوری' : row.deliveryMethod || 'نامشخص';
    deliveryMethods.set(methodLabel, (deliveryMethods.get(methodLabel) ?? 0) + row.amount);
  }

  const toSeries = (sums: Map<string, number>): SeriesPoint[] =>
    [...sums.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

  return {
    categories: toSeries(categories),
    pickupLocations: toSeries(pickupLocations),
    deliveryMethods: toSeries(deliveryMethods),
  };
}

/** سه باکس موجودی داشبورد: نقطه سفارش، رو به اتمام، خالی‌فروشی. */
export interface StockTiles {
  reorder: number;
  lowStock: number;
  oversold: number;
}

export async function getStockTiles(): Promise<StockTiles> {
  return stockAlertCounts();
}
