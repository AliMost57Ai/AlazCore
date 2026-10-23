/**
 * Dashboard statistics: values are computed from real DB rows.
 *
 * Deltas and 12-point sparkline trends remain static demo hints — the seed has
 * no real history to compute month-over-month changes from. The numbers the
 * user reads (value fields) are live; the arrows and sparklines are illustrative
 * until real order history accumulates.
 */

import prisma from './db';

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

/** Revenue by Jalali month, chronological. */
export async function getRevenueSeries(): Promise<SeriesPoint[]> {
  const rows = await prisma.order.groupBy({ by: ['month'], _sum: { amount: true } });
  const byMonth = new Map(rows.map((row) => [row.month, row._sum.amount ?? 0]));

  // Only months that actually have data — an 11-empty-month chart is noise.
  return MONTH_ORDER.filter((month) => byMonth.has(month)).map((month) => ({
    label: month,
    value: byMonth.get(month) ?? 0,
  }));
}

/** Last month's revenue vs. the month before, in percent. 0 when there's no pair. */
export async function getRevenueGrowth(): Promise<number> {
  const series = await getRevenueSeries();

  if (series.length < 2) {
    return 0;
  }

  const [previous, current] = series.slice(-2);
  if (previous.value === 0) {
    return 0;
  }

  return Math.round(((current.value - previous.value) / previous.value) * 1000) / 10;
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
