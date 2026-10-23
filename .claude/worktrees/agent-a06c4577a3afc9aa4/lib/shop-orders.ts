/**
 * Customer-facing orders: placing one from the shop cart and listing a
 * customer's own orders.
 *
 * Server-only — prices and stock come from the DB, never from the request
 * body, so a tampered client can't order at a made-up price or past zero stock.
 */

import prisma from './db';
import { applyDiscount, faJalaliDate, jalaliMonthName, toJalali } from './format';
import type { OrderStatus } from './orders';

export interface OrderItemInput {
  productId: string;
  /** Null = the plain product, no variant. */
  variantId: string | null;
  qty: number;
}

export interface OrderItem {
  productId: string;
  variantId: string | null;
  /** Display name, e.g. 'هدفون گاما — رنگ مشکی'. */
  name: string;
  qty: number;
  /** Toman per unit, resolved from the DB at order time. */
  unitPrice: number;
}

export interface CustomerOrder {
  id: string;
  displayId: string;
  date: string;
  amount: number;
  status: OrderStatus;
  trackingCode: string | null;
  items: OrderItem[];
  /** How many packages the shipment has, and which one this is (1-based). */
  packageIndex: number;
  packageCount: number;
  /** When the order was paid (drives the +3-day delivery estimate). */
  paidAt: Date | null;
  /** Delivery date the admin promised when posting the order. */
  estimatedArrival: Date | null;
}

/** Dashboard category label for orders placed through the storefront. */
const SHOP_CATEGORY = 'فروشگاه آنلاین';

function toStatus(value: string): OrderStatus {
  return value === 'paid' ||
    value === 'boxing' ||
    value === 'posted' ||
    value === 'shipped' ||
    value === 'delivered' ||
    value === 'cancelled'
    ? value
    : 'pending';
}

/** Parses an order's itemsJson defensively — malformed rows are dropped. */
export function parseItems(json: string): OrderItem[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is OrderItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as OrderItem).productId === 'string' &&
        typeof (item as OrderItem).name === 'string' &&
        typeof (item as OrderItem).qty === 'number' &&
        typeof (item as OrderItem).unitPrice === 'number'
    );
  } catch {
    return [];
  }
}

/** `ORD-` + 5 digits, retried on the (very unlikely) unique collision. */
async function nextDisplayId(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `ORD-${String(10_000 + Math.floor(Math.random() * 90_000))}`;
    const taken = await prisma.order.findUnique({
      where: { displayId: candidate },
      select: { id: true },
    });
    if (!taken) {
      return candidate;
    }
  }
  // Practically unreachable; a timestamp suffix keeps it unique regardless.
  return `ORD-${Date.now().toString().slice(-5)}`;
}

export type PlaceOrderResult =
  | { ok: true; order: CustomerOrder; merged: boolean }
  | { ok: false; error: string };

/**
 * Places an order for a signed-in customer:
 *  1. resolve every line item against the DB (price, name, current stock),
 *  2. conditionally decrement stock (`qty >= n`) so two concurrent carts can
 *     never oversell the same unit,
 *  3. create the order row — all inside one transaction.
 *
 * If the customer already has a pending (unpaid) order, the cart is merged
 * into it instead of opening a second one: matching product+variant lines add
 * up, new lines are appended, and the total is recomputed. The unpaid order is
 * effectively the customer's active basket until they pay it.
 */
export async function placeOrder(
  userId: string,
  customerName: string,
  items: OrderItemInput[]
): Promise<PlaceOrderResult> {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'سبد خرید خالی است.' };
  }

  // Reject obviously bogus payloads before touching the DB.
  for (const item of items) {
    if (typeof item.productId !== 'string' || item.qty < 1 || !Number.isInteger(item.qty)) {
      return { ok: false, error: 'اقلام سبد خرید نامعتبر است.' };
    }
  }

  const resolved: (OrderItem & { currentQty: number })[] = [];
  // List-price total (before Product.discountPercent) — the accounting page's
  // "original price". amount holds the discounted total.
  let baseTotal = 0;

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: { variants: true },
    });

    if (!product || !product.isVisible) {
      return { ok: false, error: 'یکی از محصولات سبد خرید دیگر موجود نیست.' };
    }

    const variant = item.variantId
      ? product.variants.find((row) => row.id === item.variantId)
      : null;
    if (item.variantId && !variant) {
      return { ok: false, error: 'واریانت انتخابی یکی از محصولات دیگر معتبر نیست.' };
    }

    const stock = variant ? variant.qty : product.qty;
    if (stock < item.qty) {
      const label = variant ? `${product.name} — ${variant.name}` : product.name;
      return {
        ok: false,
        error: `موجودی «${label}» کافی نیست (موجود: ${stock}).`,
      };
    }

    resolved.push({
      productId: product.id,
      variantId: variant?.id ?? null,
      name: variant ? `${product.name} — ${variant.name}` : product.name,
      qty: item.qty,
      // The product's discount percent applies to the variant price too when
      // the variant doesn't override it — same rule the shop UI displays.
      unitPrice: applyDiscount(variant?.price ?? product.price, product.discountPercent),
      currentQty: stock,
    });
    baseTotal += (variant?.price ?? product.price) * item.qty;
  }

  const total = resolved.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const displayId = await nextDisplayId();
  const now = new Date();

  // An unpaid order doubles as the active basket — merge instead of stacking
  // a second pending order behind it.
  const pendingOrder = await prisma.order.findFirst({
    where: { userId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });

  const order = await prisma
    .$transaction(async (tx) => {
      // Conditional decrement: matches nothing (updates 0 rows) when stock was
      // taken between the check above and now — then the whole order fails.
      for (const item of resolved) {
        const updated = item.variantId
          ? await tx.productVariant.updateMany({
              where: { id: item.variantId, qty: { gte: item.qty } },
              data: { qty: { decrement: item.qty } },
            })
          : await tx.product.updateMany({
              where: { id: item.productId, qty: { gte: item.qty } },
              data: { qty: { decrement: item.qty } },
            });

        if (updated.count === 0) {
          throw new Error('STOCK_RACE');
        }
      }

      if (pendingOrder) {
        const existing = parseItems(pendingOrder.itemsJson);
        const merged = [...existing];

        for (const item of resolved) {
          const line = merged.find(
            (candidate) =>
              candidate.productId === item.productId && candidate.variantId === item.variantId
          );
          if (line) {
            line.qty += item.qty;
          } else {
            merged.push({
              productId: item.productId,
              variantId: item.variantId,
              name: item.name,
              qty: item.qty,
              unitPrice: item.unitPrice,
            });
          }
        }

        return tx.order.update({
          where: { id: pendingOrder.id },
          data: {
            amount: pendingOrder.amount + total,
            baseAmount: { increment: baseTotal },
            itemsJson: JSON.stringify(merged),
          },
        });
      }

      return tx.order.create({
        data: {
          displayId,
          customer: customerName,
          date: faJalaliDate(now),
          amount: total,
          baseAmount: baseTotal,
          status: 'pending',
          category: SHOP_CATEGORY,
          month: jalaliMonthName(toJalali(now)[1]),
          userId,
          itemsJson: JSON.stringify(
            resolved.map(({ productId, variantId, name, qty, unitPrice }) => ({
              productId,
              variantId,
              name,
              qty,
              unitPrice,
            }))
          ),
        },
      });
    })
    .catch(() => null);

  if (!order) {
    return {
      ok: false,
      error: 'موجودی در لحظه ثبت تغییر کرد. سبد خود را به‌روز کنید و دوباره تلاش کنید.',
    };
  }

  return {
    ok: true,
    merged: Boolean(pendingOrder),
    order: {
      id: order.id,
      displayId: order.displayId,
      date: order.date,
      amount: order.amount,
      status: toStatus(order.status),
      trackingCode: order.trackingCode,
      items: parseItems(order.itemsJson),
      // One shipment per order for now — displayed as «بسته ۱ از ۱».
      packageIndex: 1,
      packageCount: 1,
      paidAt: order.paidAt,
      estimatedArrival: order.estimatedArrival,
    },
  };
}

/** A customer's own orders, newest first. */
export async function listCustomerOrders(userId: string): Promise<CustomerOrder[]> {
  const rows = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((row) => ({
    id: row.id,
    displayId: row.displayId,
    date: row.date,
    amount: row.amount,
    status: toStatus(row.status),
    trackingCode: row.trackingCode,
    items: parseItems(row.itemsJson),
    packageIndex: 1,
    packageCount: 1,
    paidAt: row.paidAt,
    estimatedArrival: row.estimatedArrival,
  }));
}
