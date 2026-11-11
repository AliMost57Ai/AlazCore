/**
 * Batch price-update domain logic (Finance → به‌روزرسانی قیمت).
 *
 * Lets an admin raise/lower prices across a whole group/category (recursive)
 * or one product (its variants included) by a fixed Toman amount or a
 * percent, and keeps an auditable PriceChange history.
 *
 * Sold invoices are never rewritten: Order.itemsJson snapshots each line's
 * unitPrice at order time, so past accounting is safe by construction —
 * nothing here touches orders.
 *
 * Server-only — imports lib/db. Pure helpers/types live in lib/price-adjust
 * so client components can share the arithmetic.
 */

import type { Prisma } from './generated/prisma/client';
import prisma from './db';
import {
  computeNewPrice,
  type PlannedPriceChange,
  type PriceAdjustType,
  type PriceUpdateScope,
} from './price-adjust';

export { computeNewPrice, describeAdjust } from './price-adjust';
export type { PlannedPriceChange, PriceAdjustType, PriceUpdateScope } from './price-adjust';

export interface PriceUpdateRequest {
  scope: PriceUpdateScope;
  /** Category id (its descendants included) or product id. */
  targetId: string;
  adjustType: PriceAdjustType;
  /** Toman added for 'fixed', percent points added for 'percent' (can be negative). */
  adjustValue: number;
}

/** All descendant category ids (the tree is group → categories, but this walks any depth). */
async function descendantCategoryIds(categoryId: string): Promise<string[]> {
  const ids = [categoryId];
  for (let i = 0; i < ids.length; i += 1) {
    const children = await prisma.category.findMany({
      where: { parentId: ids[i] },
      select: { id: true },
    });
    for (const child of children) {
      if (!ids.includes(child.id)) {
        ids.push(child.id);
      }
    }
  }
  return ids;
}

/**
 * Validates an untrusted request body as a price update.
 * Returns Persian error messages — empty means valid.
 */
export function validatePriceUpdateRequest(input: unknown): string[] {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null) {
    return ['درخواست نامعتبر است.'];
  }

  const body = input as Record<string, unknown>;
  if (body.scope !== 'category' && body.scope !== 'product') {
    errors.push('نوع هدف باید گروه کالا یا کالا باشد.');
  }
  if (typeof body.targetId !== 'string' || body.targetId.trim().length === 0) {
    errors.push('هدف تغییر قیمت مشخص نشده است.');
  }
  if (body.adjustType !== 'fixed' && body.adjustType !== 'percent') {
    errors.push('نوع تغییر باید عدد ثابت یا درصد باشد.');
  }
  if (typeof body.adjustValue !== 'number' || !Number.isFinite(body.adjustValue)) {
    errors.push('مقدار تغییر باید عدد باشد.');
  } else if (
    body.adjustType === 'percent' &&
    (body.adjustValue < -100 || body.adjustValue > 1000)
  ) {
    errors.push('درصد تغییر باید بین ۱۰۰- و ۱۰۰۰ باشد.');
  } else if (body.adjustType === 'fixed' && Math.abs(body.adjustValue) > 1_000_000_000) {
    errors.push('مقدار تغییر نامعتبر است.');
  }
  return errors;
}

interface ResolvedTarget {
  /** Persian label for the history rows. */
  targetName: string;
  /** Product rows (with variants) in scope. */
  products: {
    id: string;
    name: string;
    price: number;
    variants: { id: string; name: string; price: number | null }[];
  }[];
}

/** Resolves the request's target into the concrete product rows in scope. */
async function resolveTarget(request: PriceUpdateRequest): Promise<ResolvedTarget | null> {
  if (request.scope === 'category') {
    const category = await prisma.category.findUnique({
      where: { id: request.targetId },
      select: { name: true },
    });
    if (!category) {
      return null;
    }
    const ids = await descendantCategoryIds(request.targetId);
    const joins = await prisma.productCategory.findMany({
      where: { categoryId: { in: ids } },
      select: { productId: true },
    });
    const productIds = [...new Set(joins.map((join) => join.productId))];
    if (productIds.length === 0) {
      return { targetName: category.name, products: [] };
    }
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        price: true,
        variants: { select: { id: true, name: true, price: true } },
      },
      orderBy: { name: 'asc' },
    });
    return { targetName: category.name, products };
  }

  const product = await prisma.product.findUnique({
    where: { id: request.targetId },
    select: {
      id: true,
      name: true,
      price: true,
      variants: { select: { id: true, name: true, price: true } },
    },
  });
  if (!product) {
    return null;
  }
  return { targetName: product.name, products: [product] };
}

/**
 * Computes every price move the request would make, without writing anything.
 * Variants with price = null (inherit the product price) move with the
 * product and get no separate row.
 */
export async function previewPriceUpdate(
  request: PriceUpdateRequest
): Promise<{ targetName: string; changes: PlannedPriceChange[] }> {
  const target = await resolveTarget(request);
  if (!target) {
    return { targetName: '', changes: [] };
  }

  const changes: PlannedPriceChange[] = [];
  for (const product of target.products) {
    const newPrice = computeNewPrice(product.price, request.adjustType, request.adjustValue);
    if (newPrice !== product.price) {
      changes.push({
        productId: product.id,
        productName: product.name,
        variantId: null,
        variantName: null,
        oldPrice: product.price,
        newPrice,
      });
    }
    for (const variant of product.variants) {
      if (variant.price === null) {
        continue; // inherits the product price — already covered above
      }
      const variantNew = computeNewPrice(variant.price, request.adjustType, request.adjustValue);
      if (variantNew !== variant.price) {
        changes.push({
          productId: product.id,
          productName: product.name,
          variantId: variant.id,
          variantName: variant.name,
          oldPrice: variant.price,
          newPrice: variantNew,
        });
      }
    }
  }
  return { targetName: target.targetName, changes };
}

export interface ApplyPriceUpdateResult {
  /** Persian error — set when nothing was applied. */
  error?: string;
  applied?: number;
  changes?: PlannedPriceChange[];
}

/**
 * Applies a batch price update inside one transaction: every product price
 * and explicit variant price in scope moves, and one PriceChange history row
 * is written per actual change (grouped by a shared batchId).
 * Orders are never touched.
 */
export async function applyPriceUpdate(
  request: PriceUpdateRequest,
  actorName: string
): Promise<ApplyPriceUpdateResult> {
  const target = await resolveTarget(request);
  if (!target) {
    return { error: 'هدف تغییر قیمت یافت نشد.' };
  }

  const preview = await previewPriceUpdate(request);
  if (preview.changes.length === 0) {
    return { error: 'هیچ قیمتی با این تغییر جابه‌جا نمی‌شود.' };
  }

  const batchId = `pc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  await prisma.$transaction(async (tx) => {
    for (const change of preview.changes) {
      if (change.variantId === null) {
        await tx.product.update({
          where: { id: change.productId },
          data: { price: change.newPrice },
        });
      } else {
        await tx.productVariant.update({
          where: { id: change.variantId },
          data: { price: change.newPrice },
        });
      }
      await tx.priceChange.create({
        data: {
          batchId,
          productId: change.productId,
          variantId: change.variantId,
          variantName: change.variantName,
          oldPrice: change.oldPrice,
          newPrice: change.newPrice,
          scope: request.scope,
          targetName: target.targetName,
          adjustType: request.adjustType,
          adjustValue: request.adjustValue,
          actorName,
        },
      });
    }
  });

  return { applied: preview.changes.length, changes: preview.changes };
}

export interface PriceChangeBatchDTO {
  batchId: string;
  createdAt: string;
  actorName: string;
  scope: string;
  targetName: string;
  adjustType: string;
  adjustValue: number;
  changes: PlannedPriceChange[];
}

type PriceChangeRow = Prisma.PriceChangeGetPayload<{
  include: { product: { select: { name: true } } };
}>;

function toPlannedChange(row: PriceChangeRow): PlannedPriceChange {
  return {
    productId: row.productId,
    productName: row.product.name,
    variantId: row.variantId,
    variantName: row.variantName,
    oldPrice: row.oldPrice,
    newPrice: row.newPrice,
  };
}

/** One history block from the rows that share a batchId (already newest-first). */
function toBatchDTO(batchId: string, rows: PriceChangeRow[]): PriceChangeBatchDTO {
  const head = rows[0];
  return {
    batchId,
    createdAt: head.createdAt.toISOString(),
    actorName: head.actorName,
    scope: head.scope,
    targetName: head.targetName,
    adjustType: head.adjustType,
    adjustValue: head.adjustValue,
    changes: rows.map(toPlannedChange),
  };
}

/** Recent price-update history, newest first, grouped into batches. */
export async function listPriceChangeBatches(limit = 100): Promise<PriceChangeBatchDTO[]> {
  const rows = await prisma.priceChange.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { product: { select: { name: true } } },
  });

  // Rows arrive newest-first; group consecutive rows sharing a batchId while
  // keeping that order.
  const batches: PriceChangeBatchDTO[] = [];
  for (const row of rows) {
    const latest = batches[batches.length - 1];
    if (latest && latest.batchId === row.batchId) {
      latest.changes.push(toPlannedChange(row));
      continue;
    }
    batches.push(toBatchDTO(row.batchId, [row]));
  }
  return batches;
}

/** Batches per page of /price-history — pagination is by batch, not by row. */
export const PRICE_HISTORY_PAGE_SIZE = 20;

/** GET filters of /price-history, straight from the URL query string. */
export interface PriceHistoryFilters {
  /** ISO instant of the first day (local midnight) — the whole day is included. */
  from?: string;
  /** ISO instant of the last day (local midnight) — the whole day is included. */
  to?: string;
  /** Category id; its descendants are included. Ignored when `productId` is set. */
  categoryId?: string;
  /** Single product id — takes precedence over `categoryId`. */
  productId?: string;
}

export interface PriceHistoryPage {
  batches: PriceChangeBatchDTO[];
  page: number;
  hasMore: boolean;
}

/**
 * Local-day bound of a picker value: «از تاریخ» starts at that day's local
 * midnight, «تا تاریخ» ends at its 23:59:59.999 — the same boundary semantics
 * lib/financial-reports.ts uses, so a picked day is included as a whole day.
 * The picker hands back the ISO instant of that local midnight (pickerValue.ts).
 */
function parseDayBound(value: string | undefined, endOfDay: boolean): Date | null {
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

/**
 * The /price-history audit trail, filtered and paged.
 *
 * Filters (all optional, from the URL): «از تاریخ»/«تا تاریخ» as full local
 * days, a group/category (expanded to its descendants) and a product. A chosen
 * product wins over the chosen category — that is what the filter bar's hint
 * promises.
 *
 * Paging is per **batch**, not per row: one admin action on 200 products must
 * not eat a whole page, so each page is PRICE_HISTORY_PAGE_SIZE batches, newest
 * first, and every batch arrives with all of its price moves.
 */
export async function listPriceChangeHistory(
  filters: PriceHistoryFilters = {},
  page = 1
): Promise<PriceHistoryPage> {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;

  const where: Prisma.PriceChangeWhereInput = {};
  const gte = parseDayBound(filters.from, false);
  const lte = parseDayBound(filters.to, true);
  if (gte || lte) {
    const range: Prisma.DateTimeFilter = {};
    if (gte) {
      range.gte = gte;
    }
    if (lte) {
      range.lte = lte;
    }
    where.createdAt = range;
  }

  if (filters.productId) {
    where.productId = filters.productId;
  } else if (filters.categoryId) {
    // Group → its sub-categories, any depth (same walk applyPriceUpdate uses).
    const categoryIds = await descendantCategoryIds(filters.categoryId);
    const joins = await prisma.productCategory.findMany({
      where: { categoryId: { in: categoryIds } },
      select: { productId: true },
    });
    where.productId = { in: [...new Set(joins.map((join) => join.productId))] };
  }

  // Group ids first, so a page boundary never splits one admin action across two
  // pages. One extra row tells us whether a next page exists.
  const groups = await prisma.priceChange.groupBy({
    by: ['batchId'],
    where,
    orderBy: [{ _max: { createdAt: 'desc' } }, { batchId: 'asc' }],
    skip: (safePage - 1) * PRICE_HISTORY_PAGE_SIZE,
    take: PRICE_HISTORY_PAGE_SIZE + 1,
    _max: { createdAt: true },
  });

  const hasMore = groups.length > PRICE_HISTORY_PAGE_SIZE;
  const batchIds = groups.slice(0, PRICE_HISTORY_PAGE_SIZE).map((group) => group.batchId);
  if (batchIds.length === 0) {
    return { batches: [], page: safePage, hasMore: false };
  }

  // Every row of the chosen batches — the date/product filters were already
  // applied when the batches were picked, so a batch is shown whole.
  const rows = await prisma.priceChange.findMany({
    where: { batchId: { in: batchIds } },
    include: { product: { select: { name: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  const rowsByBatch = new Map<string, PriceChangeRow[]>();
  for (const row of rows) {
    const list = rowsByBatch.get(row.batchId);
    if (list) {
      list.push(row);
    } else {
      rowsByBatch.set(row.batchId, [row]);
    }
  }

  const batches: PriceChangeBatchDTO[] = [];
  for (const batchId of batchIds) {
    const batchRows = rowsByBatch.get(batchId);
    if (batchRows && batchRows.length > 0) {
      batches.push(toBatchDTO(batchId, batchRows));
    }
  }

  return { batches, page: safePage, hasMore };
}
