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
      latest.changes.push({
        productId: row.productId,
        productName: row.product.name,
        variantId: row.variantId,
        variantName: row.variantName,
        oldPrice: row.oldPrice,
        newPrice: row.newPrice,
      });
      continue;
    }
    batches.push({
      batchId: row.batchId,
      createdAt: row.createdAt.toISOString(),
      actorName: row.actorName,
      scope: row.scope,
      targetName: row.targetName,
      adjustType: row.adjustType,
      adjustValue: row.adjustValue,
      changes: [
        {
          productId: row.productId,
          productName: row.product.name,
          variantId: row.variantId,
          variantName: row.variantName,
          oldPrice: row.oldPrice,
          newPrice: row.newPrice,
        },
      ],
    });
  }
  return batches;
}
