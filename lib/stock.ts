/**
 * هشدارهای موجودی — لیست خرید (نقطه سفارش)، رو به اتمام (حداقل موجودی) و
 * مجموع خالی‌فروشی. داده از دیتابیس همین سایت (multi-tenant لایه db).
 *
 * مقایسه نقطه سفارش/حداقل موجودی با موجودی عمداً در JS انجام می‌شود نه با
 * فیلد-رفرنس پرایسما (prisma.product.fields.*) — پراکسی multi-tenant در
 * lib/db.ts دسترسی به fields را پشتیبانی نمی‌کرد و کوئری بی‌صدا خالی
 * برمی‌گشت. تعداد کالاهای دارای آستانه کم است؛ خواندن و فیلتر محلی ارزان است.
 */

import prisma from './db';

export interface StockAlertRow {
  id: string;
  name: string;
  qty: number;
  threshold: number;
}

/** کالاهایی که موجودی‌شان به نقطه سفارش رسیده (شامل منفی‌ها). */
export async function reorderList(): Promise<StockAlertRow[]> {
  const rows = await prisma.product.findMany({
    where: { reorderPoint: { not: null } },
    select: { id: true, name: true, qty: true, reorderPoint: true },
    orderBy: { qty: 'asc' },
  });
  return rows
    .filter((row) => row.reorderPoint !== null && row.qty <= row.reorderPoint)
    .map((row) => ({
      id: row.id,
      name: row.name,
      qty: row.qty,
      threshold: row.reorderPoint ?? 0,
    }));
}

/** کالاهایی که موجودی‌شان به حداقل رسیده یا کمتر است (رو به اتمام). */
export async function lowStockList(): Promise<StockAlertRow[]> {
  const rows = await prisma.product.findMany({
    where: { minStock: { not: null } },
    select: { id: true, name: true, qty: true, minStock: true },
    orderBy: { qty: 'asc' },
  });
  return rows
    .filter((row) => row.minStock !== null && row.qty <= row.minStock)
    .map((row) => ({
      id: row.id,
      name: row.name,
      qty: row.qty,
      threshold: row.minStock ?? 0,
    }));
}

/** شمار اعلان‌ها برای داشبورد — «خالی‌فروشی» = تعداد کالاهای همان لیست،
 *  تا باکس داشبورد و badge منو/زنگ همیشه یک عدد بگویند. */
export async function stockAlertCounts(): Promise<{
  reorder: number;
  lowStock: number;
  oversold: number;
}> {
  const [reorder, lowStock, oversell] = await Promise.all([
    reorderList(),
    lowStockList(),
    oversellList(),
  ]);
  return { reorder: reorder.length, lowStock: lowStock.length, oversold: oversell.length };
}

export interface OversellRow {
  id: string;
  name: string;
  qty: number;
  /** سقف خالی‌فروشی همین کالا؛ null = بدون سقف کالایی (سقف کل فروشگاه حاکم است). */
  oversellMax: number | null;
}

/**
 * صفحه «خالی‌فروشی» — کالاهایی که مجوز خالی‌فروشی دارند و موجودی‌شان صفر یا
 * منفی شده (در ویترین با برچسب «تنها ۱ عدد باقی مانده» قابل خریدند).
 */
export async function oversellList(): Promise<OversellRow[]> {
  return prisma.product.findMany({
    where: { oversellAllowed: true, qty: { lte: 0 } },
    select: { id: true, name: true, qty: true, oversellMax: true },
    orderBy: { qty: 'asc' },
  });
}

/** خط itemsJson با شناسه — برای چک زنده کسری خطوط سفارش. */
interface DeficitLine {
  productId: string;
  variantId: string | null;
  qty: number;
}

/**
 * آیا هنوز خطِ کسری‌ای (موجودی منفی) روی سفارش باز است؟ مبنای قفل
 * «بسته‌بندی» سفارش خالی‌فروشی: بعد از افزایش موجودی، خط منفی صفر/مثبت
 * می‌شود و سفارش آزاد می‌گردد.
 */
export async function oversellOrderDeficit(itemsJson: string): Promise<boolean> {
  let lines: DeficitLine[] = [];
  try {
    const parsed: unknown = JSON.parse(itemsJson);
    if (Array.isArray(parsed)) {
      lines = parsed
        .filter(
          (line): line is Record<string, unknown> => typeof line === 'object' && line !== null
        )
        .filter(
          (line) =>
            typeof line.productId === 'string' &&
            (line.variantId === null || typeof line.variantId === 'string') &&
            typeof line.qty === 'number' &&
            line.qty > 0
        )
        .map((line) => ({
          productId: line.productId as string,
          variantId: (line.variantId as string | null) ?? null,
          qty: line.qty as number,
        }));
    }
  } catch {
    return false;
  }

  const productIds = [
    ...new Set(lines.filter((line) => !line.variantId).map((line) => line.productId)),
  ];
  const variantIds = [
    ...new Set(lines.filter((line) => line.variantId).map((line) => line.variantId as string)),
  ];
  const [products, variants] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, qty: true },
        })
      : Promise.resolve([] as { id: string; qty: number }[]),
    variantIds.length
      ? prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, qty: true },
        })
      : Promise.resolve([] as { id: string; qty: number }[]),
  ]);

  return lines.some((line) => {
    const qty = line.variantId
      ? variants.find((row) => row.id === line.variantId)?.qty
      : products.find((row) => row.id === line.productId)?.qty;
    return qty != null && qty < 0;
  });
}
