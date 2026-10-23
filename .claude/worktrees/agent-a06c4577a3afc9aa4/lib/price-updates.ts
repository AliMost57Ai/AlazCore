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

import { Prisma } from '@prisma/client';
import prisma from './db';
import { faCurrency, faNumber } from './format';
import {
  computeNewPrice,
  describeAdjust,
  type PlannedPriceChange,
  type PriceAdjustType,
  type PriceUpdateScope,
} from './price-adjust';
import { logSystemAudit } from './system-logs';

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

  // The PriceChange rows above are the itemised history; this is the one-line
  // entry that makes a price move visible next to every other staff action.
  const amounts = preview.changes.map((change) => change.newPrice);
  await logSystemAudit({
    kind: 'price',
    action: 'price',
    actor: actorName,
    message: `قیمت‌های «${target.targetName}» ${describeAdjust(request.adjustType, request.adjustValue)} یافت (${faNumber(preview.changes.length)} مورد).`,
    detail: [
      `هدف: ${request.scope === 'category' ? 'گروه/دسته' : 'محصول'} «${target.targetName}»`,
      `نوع تغییر: ${describeAdjust(request.adjustType, request.adjustValue)}`,
      `تعداد قیمت تغییرکرده: ${faNumber(preview.changes.length)}`,
      `بازه قیمت جدید: ${faCurrency(Math.min(...amounts), false)} تا ${faCurrency(Math.max(...amounts))}`,
    ].join('\n'),
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

/** A history row with its product name joined in. */
type PriceChangeRow = Prisma.PriceChangeGetPayload<{
  include: { product: { select: { name: true } } };
}>;

/**
 * Groups history rows into batches, keyed by batchId and insertion-ordered.
 *
 * Keyed rather than "merge consecutive rows": SQLite's CURRENT_TIMESTAMP has
 * second resolution, so two batches applied within the same second interleave
 * under any createdAt-only ordering and a consecutive-run merge would split
 * one batch in two.
 */
function groupBatches(rows: PriceChangeRow[]): Map<string, PriceChangeBatchDTO> {
  const batches = new Map<string, PriceChangeBatchDTO>();
  for (const row of rows) {
    const change: PlannedPriceChange = {
      productId: row.productId,
      productName: row.product.name,
      variantId: row.variantId,
      variantName: row.variantName,
      oldPrice: row.oldPrice,
      newPrice: row.newPrice,
    };
    const existing = batches.get(row.batchId);
    if (existing) {
      existing.changes.push(change);
      continue;
    }
    batches.set(row.batchId, {
      batchId: row.batchId,
      createdAt: row.createdAt.toISOString(),
      actorName: row.actorName,
      scope: row.scope,
      targetName: row.targetName,
      adjustType: row.adjustType,
      adjustValue: row.adjustValue,
      changes: [change],
    });
  }
  return batches;
}

/** Recent price-update history, newest first, grouped into batches. */
export async function listPriceChangeBatches(limit = 100): Promise<PriceChangeBatchDTO[]> {
  const rows = await prisma.priceChange.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { product: { select: { name: true } } },
  });
  return [...groupBatches(rows).values()];
}

export interface PriceHistoryFilters {
  /** ISO instant, inclusive lower bound — as handed back by the Jalali picker. */
  from?: string;
  /**
   * ISO instant of the *start* of the last wanted day. The picker always
   * returns the selected day's local midnight, and a date filter means whole
   * days, so the bound is widened to that day's end — picking today includes
   * everything recorded today. Widening by a fixed 24h (rather than reading
   * the hour) keeps this correct whatever timezone the server runs in.
   */
  to?: string;
  /** A group/category id — its descendants are included. */
  categoryId?: string;
  /** A single product — wins over categoryId when both are present. */
  productId?: string;
}

export interface PriceHistoryPage {
  batches: PriceChangeBatchDTO[];
  page: number;
  hasMore: boolean;
}

/** Batches per page on /price-history. */
export const PRICE_HISTORY_PAGE_SIZE = 20;

/** Total recorded price moves (rows, not batches) — for the update page's blurb. */
export async function countPriceChanges(): Promise<number> {
  return prisma.priceChange.count();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parses an ISO filter value, ignoring anything unparseable (treated as "no filter"). */
function parseInstant(value?: string): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function priceHistoryWhere(
  filters: PriceHistoryFilters
): Promise<Prisma.PriceChangeWhereInput> {
  const where: Prisma.PriceChangeWhereInput = {};

  const from = parseInstant(filters.from);
  const to = parseInstant(filters.to);
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: new Date(to.getTime() + DAY_MS - 1) } : {}),
    };
  }

  if (filters.productId) {
    where.productId = filters.productId;
  } else if (filters.categoryId) {
    const ids = await descendantCategoryIds(filters.categoryId);
    where.product = { categories: { some: { categoryId: { in: ids } } } };
  }

  return where;
}

/**
 * Filtered, paged price-change history for /price-history.
 *
 * Paging is by *batch*, not by row: one action over a 200-product group writes
 * 200 rows, and a row-paged list would spend a whole page on that single
 * action and split the rest across pages.
 *
 * `hasMore` comes from fetching one batch beyond the page — cheaper and just
 * as correct as a second count query over a growing table.
 */
export async function listPriceChangeHistory(
  filters: PriceHistoryFilters = {},
  page = 1
): Promise<PriceHistoryPage> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const where = await priceHistoryWhere(filters);

  const groups = await prisma.priceChange.groupBy({
    by: ['batchId'],
    where,
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    skip: (safePage - 1) * PRICE_HISTORY_PAGE_SIZE,
    take: PRICE_HISTORY_PAGE_SIZE + 1,
  });

  const hasMore = groups.length > PRICE_HISTORY_PAGE_SIZE;
  const ids = groups.slice(0, PRICE_HISTORY_PAGE_SIZE).map((group) => group.batchId);
  if (ids.length === 0) {
    return { batches: [], page: safePage, hasMore: false };
  }

  const rows = await prisma.priceChange.findMany({
    where: { batchId: { in: ids } },
    orderBy: { createdAt: 'desc' },
    include: { product: { select: { name: true } } },
  });

  // Order by the groupBy ranking (which already applied skip/take), never by
  // the row query's own ordering.
  const grouped = groupBatches(rows);
  return {
    batches: ids
      .map((id) => grouped.get(id))
      .filter((batch): batch is PriceChangeBatchDTO => batch !== undefined),
    page: safePage,
    hasMore,
  };
}
