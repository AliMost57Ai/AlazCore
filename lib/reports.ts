/**
 * گزارشات مالی داشبورد مالک — روی دیتابیس همین سایت (multi-tenant خود لایه
 * db حل می‌کند) و بدون فیلتر دامنه: گزارش‌ها همیشه مال همین سایت‌اند.
 *
 *  ۱. محصولات تعریف‌شده
 *  ۲. خلاصه فروش هر کالا
 *  ۳. مجموع فروش ماهانه (برچسب شمسی ستون month سفارش)
 *  ۴. کارمزد AlazCore = commissionPercent لایسنس × فروش فیلترشده
 *
 * «فروش» = سفارش‌های غیر pending/cancelled؛ فیلتر تاریخ روی createdAt.
 */

import { currentDomain, getLicense } from './core-license';
import prisma from './db';

export interface ReportFilters {
  /** yyyy-mm-dd — روی createdAt سفارش‌ها. */
  from?: string;
  to?: string;
  categoryId?: string;
  productName?: string;
}

function orderDateRange(filters: ReportFilters): Record<string, Date> {
  const range: Record<string, Date> = {};
  if (filters.from) {
    range.gte = new Date(`${filters.from}T00:00:00`);
  }
  if (filters.to) {
    range.lte = new Date(`${filters.to}T23:59:59.999`);
  }
  return range;
}

interface OrderItemLine {
  name?: unknown;
  qty?: unknown;
  unitPrice?: unknown;
  productId?: unknown;
}

function parseItems(itemsJson: string): OrderItemLine[] {
  try {
    const parsed: unknown = JSON.parse(itemsJson);
    return Array.isArray(parsed) ? (parsed as OrderItemLine[]) : [];
  } catch {
    return [];
  }
}

async function loadSaleOrders(
  filters: ReportFilters
): Promise<{ amount: number; month: string; items: OrderItemLine[] }[]> {
  const where: Record<string, unknown> = { status: { notIn: ['pending', 'cancelled'] } };
  const range = orderDateRange(filters);
  if (range.gte || range.lte) {
    where.createdAt = range;
  }
  const rows = await prisma.order.findMany({
    where,
    select: { amount: true, month: true, itemsJson: true },
  });
  return rows.map((row) => ({
    amount: row.amount,
    month: row.month,
    items: parseItems(row.itemsJson),
  }));
}

async function itemFilter(
  filters: ReportFilters
): Promise<((line: OrderItemLine) => boolean) | null> {
  if (!filters.productName && !filters.categoryId) {
    return null;
  }
  const where: Record<string, unknown> = {};
  if (filters.productName) {
    where.name = { contains: filters.productName };
  }
  let categoryIds: string[] = [];
  if (filters.categoryId) {
    const inCategory = await prisma.productCategory.findMany({
      where: { categoryId: filters.categoryId },
      select: { productId: true },
    });
    categoryIds = inCategory.map((row) => row.productId);
    where.id = { in: categoryIds };
  }
  const products = await prisma.product.findMany({ where, select: { id: true, name: true } });
  const nameById = new Map(products.map((p) => [p.id, p.name]));
  const lowerName = (filters.productName ?? '').trim().toLowerCase();

  return (line: OrderItemLine) => {
    const lineName = typeof line.name === 'string' ? line.name.toLowerCase() : '';
    const mappedName = (
      typeof line.productId === 'string' ? nameById.get(line.productId) : null
    )?.toLowerCase();
    if (lowerName && !(lineName.includes(lowerName) || mappedName?.includes(lowerName))) {
      return false;
    }
    if (
      filters.categoryId &&
      !(typeof line.productId === 'string' && categoryIds.includes(line.productId))
    ) {
      return false;
    }
    return true;
  };
}

function lineRevenue(lines: OrderItemLine[]): number {
  return lines.reduce(
    (sum, line) =>
      sum +
      (typeof line.qty === 'number' ? line.qty : 0) *
        (typeof line.unitPrice === 'number' ? line.unitPrice : 0),
    0
  );
}

/** دسته‌های کالای این سایت — برای فیلتر گروه کالا. */
export async function listOwnerCategories(): Promise<{ id: string; name: string }[]> {
  return prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
}

/** درصد پورسانت AlazCore این سایت از لایسنس (۰ تا Core وصل نشده). */
export async function ownerCommissionPercent(): Promise<number> {
  const license = await getLicense(await currentDomain());
  return license?.commissionPercent ?? 0;
}

/** ۱) محصولات تعریف‌شده. */
export async function ownerProductsReport(filters: ReportFilters): Promise<{
  productCount: number;
  sample: string[];
}> {
  const where: Record<string, unknown> = {};
  if (filters.productName) {
    where.name = { contains: filters.productName };
  }
  if (filters.categoryId) {
    const inCategory = await prisma.productCategory.findMany({
      where: { categoryId: filters.categoryId },
      select: { productId: true },
    });
    where.id = { in: inCategory.map((row) => row.productId) };
  }
  const [count, sample] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { name: true },
    }),
  ]);
  return { productCount: count, sample: sample.map((p) => p.name) };
}

/** ۲) فروش هر کالا. */
export async function ownerProductSales(filters: ReportFilters): Promise<{
  items: { name: string; qty: number; revenue: number }[];
  total: number;
}> {
  const orders = await loadSaleOrders(filters);
  const filterLine = await itemFilter(filters);
  const byProduct = new Map<string, { qty: number; revenue: number }>();
  let total = 0;
  for (const order of orders) {
    if (filterLine) {
      const lines = order.items.filter(filterLine);
      total += lineRevenue(lines);
      for (const line of lines) {
        const name = typeof line.name === 'string' ? line.name : 'کالا';
        const qty = typeof line.qty === 'number' ? line.qty : 0;
        const unitPrice = typeof line.unitPrice === 'number' ? line.unitPrice : 0;
        const bucket = byProduct.get(name) ?? { qty: 0, revenue: 0 };
        bucket.qty += qty;
        bucket.revenue += qty * unitPrice;
        byProduct.set(name, bucket);
      }
    } else {
      total += order.amount;
      for (const line of order.items) {
        const name = typeof line.name === 'string' ? line.name : 'کالا';
        const qty = typeof line.qty === 'number' ? line.qty : 0;
        const unitPrice = typeof line.unitPrice === 'number' ? line.unitPrice : 0;
        const bucket = byProduct.get(name) ?? { qty: 0, revenue: 0 };
        bucket.qty += qty;
        bucket.revenue += qty * unitPrice;
        byProduct.set(name, bucket);
      }
    }
  }
  return {
    items: [...byProduct.entries()]
      .map(([name, bucket]) => ({ name, ...bucket }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 50),
    total,
  };
}

/** ۳) فروش ماهانه. */
export async function ownerMonthlySales(filters: ReportFilters): Promise<{
  months: { month: string; orders: number; total: number }[];
  total: number;
}> {
  const orders = await loadSaleOrders(filters);
  const filterLine = await itemFilter(filters);
  const byMonth = new Map<string, { orders: number; total: number }>();
  let grand = 0;
  for (const order of orders) {
    const orderTotal = filterLine ? lineRevenue(order.items.filter(filterLine)) : order.amount;
    const bucket = byMonth.get(order.month) ?? { orders: 0, total: 0 };
    bucket.orders += 1;
    bucket.total += orderTotal;
    byMonth.set(order.month, bucket);
    grand += orderTotal;
  }
  return {
    months: [...byMonth.entries()].map(([month, bucket]) => ({ month, ...bucket })),
    total: grand,
  };
}

/** ۴) کارمزد AlazCore — درصد از فروش فیلترشده. */
export async function ownerRevenueReport(filters: ReportFilters): Promise<{
  totalSales: number;
  commissionPercent: number;
  commissionAmount: number;
}> {
  const [orders, percent] = await Promise.all([loadSaleOrders(filters), ownerCommissionPercent()]);
  const filterLine = await itemFilter(filters);
  const total = orders.reduce((sum, order) => {
    if (!filterLine) {
      return sum + order.amount;
    }
    return sum + lineRevenue(order.items.filter(filterLine));
  }, 0);
  return {
    totalSales: total,
    commissionPercent: percent,
    commissionAmount: Math.round((total * percent) / 100),
  };
}
