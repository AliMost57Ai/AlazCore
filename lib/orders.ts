/**
 * Orders: DB queries plus the UI constants that used to live in lib/data.ts.
 */

import type { Prisma } from './generated/prisma/client';
import prisma from './db';
import { fromFaDigits } from './format';
import { parseOrderLinesWithIds } from './order-cancel';
import { STATUS_COLORS, STATUS_LABELS, type OrderStatus } from './order-status';

export { type OrderStatus, STATUS_LABELS, STATUS_COLORS };

export interface OrderItemLine {
  name: string;
  qty: number;
  unitPrice: number;
  /** شناسه کالا/واریانت — مبنای عملیات قلمی (حذف قلم) در پنل. */
  productId?: string;
  variantId?: string | null;
}

/** itemsJson سفارش → خطوط کالا؛ ردیف‌های خراب بی‌سروصدا حذف می‌شوند. */
export function parseOrderItems(itemsJson: string): OrderItemLine[] {
  try {
    const parsed: unknown = JSON.parse(itemsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((line): line is Record<string, unknown> => typeof line === 'object' && line !== null)
      .map((line) => ({
        name: typeof line.name === 'string' ? line.name : 'کالا',
        qty: typeof line.qty === 'number' && line.qty > 0 ? Math.floor(line.qty) : 0,
        unitPrice: typeof line.unitPrice === 'number' && line.unitPrice >= 0 ? line.unitPrice : 0,
        productId: typeof line.productId === 'string' ? line.productId : undefined,
        variantId:
          line.variantId === null || typeof line.variantId === 'string'
            ? (line.variantId as string | null)
            : undefined,
      }))
      .filter((line) => line.qty > 0);
  } catch {
    return [];
  }
}

export interface Order {
  id: string;
  customer: string;
  /** Pre-formatted Jalali date string (see prisma/schema.prisma). */
  date: string;
  /** تاریخ خام ثبت سفارش — مبنای مرتب‌سازی زمانی ستون تاریخ. */
  createdAt: Date;
  amount: number;
  status: OrderStatus;
  trackingCode: string | null;
  /** Whether the shipping-notice SMS has been sent to the customer. */
  notified: boolean;
  /** The customer's registered phone when the order is tied to an account. */
  phone: string | null;
  /** اقلام سفارش — برای جزئیات در جدول سفارش‌ها و حسابداری. */
  items: OrderItemLine[];
  /** سفارش شامل خط فروخته‌شده بدون موجودی (خالی‌فروشی) است. */
  oversell: boolean;
  /** خالی‌فروشی با کسری باز — بسته‌بندی تا افزایش موجودی قفل است. */
  oversellBlocked: boolean;
  /** آخرین پیام فروشگاه به مشتری (علت لغو، توضیح حذف قلم…). */
  shopNote: string | null;
}

/** ردیف خام مدل Order پرایسما — DTO بالا را با آن پر می‌کنیم. */
type OrderRow = Awaited<ReturnType<typeof prisma.order.findMany>>[number];

function toStatus(value: string): OrderStatus {
  return value === 'paid' ||
    value === 'pending' ||
    value === 'boxing' ||
    value === 'posted' ||
    value === 'shipped' ||
    value === 'delivered' ||
    value === 'cancelled'
    ? value
    : 'pending';
}

/** Statuses the orders-page filter accepts (every known status). */
const FILTERABLE_STATUSES: string[] = Object.keys(STATUS_LABELS);

export interface OrderFilters {
  /** Free-text: matches customer name, order id or the customer's phone. */
  search?: string;
  /** One of the known statuses, or undefined for all. */
  status?: string;
  /** 'yes' → فقط سفارش‌های دارای خالی‌فروشی. */
  oversell?: string;
}

/**
 * Builds the Prisma `where` for the orders-page filters. `userId` has no DB
 * relation (it's a plain column), so a phone search first resolves the
 * matching users and then matches their orders.
 */
async function ordersWhere(filters: OrderFilters): Promise<Prisma.OrderWhereInput> {
  const where: Prisma.OrderWhereInput = {};

  if (filters.status && FILTERABLE_STATUSES.includes(filters.status)) {
    where.status = filters.status;
  }

  if (filters.oversell === 'yes') {
    where.oversell = true;
  }

  const search = filters.search?.trim();
  if (search) {
    // Typed digits may be Persian — normalize so ids and phones still match.
    const normalized = fromFaDigits(search);
    const or: Prisma.OrderWhereInput[] = [
      { displayId: { contains: normalized } },
      { customer: { contains: search } },
      // جستجو در اقلام کالا — itemsJson نام کالاها را نگه می‌دارد.
      { itemsJson: { contains: search } },
    ];

    const users = await prisma.user.findMany({
      where: { phone: { contains: normalized } },
      select: { id: true },
    });
    if (users.length > 0) {
      or.push({ userId: { in: users.map((user) => user.id) } });
    }

    where.OR = or;
  }

  return where;
}

export async function listOrders(limit?: number, filters: OrderFilters = {}): Promise<Order[]> {
  const rows = await prisma.order.findMany({
    where: await ordersWhere(filters),
    orderBy: { displayId: 'desc' },
    ...(limit ? { take: limit } : {}),
  });

  return withPhones(rows);
}

/** یک سفارش با شناسه نمایشی (ORD-xxxxx) — صفحه اقلام سفارش در موبایل. */
export async function getOrderByDisplayId(displayId: string): Promise<Order | null> {
  const rows = await prisma.order.findMany({
    where: { displayId },
    take: 1,
  });
  const [order] = await withPhones(rows);
  return order ?? null;
}

/** نقشه ردیف‌های خام → Order با حل موبایل کاربر (یک کوئری، بدون N+1). */
async function withPhones(rows: OrderRow[]): Promise<Order[]> {
  // Resolve account phones for the matched orders (one query, no N+1).
  const userIds = [...new Set(rows.map((row) => row.userId).filter((id): id is string => !!id))];
  const phones = new Map(
    userIds.length > 0
      ? (
          await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, phone: true },
          })
        ).map((user) => [user.id, user.phone])
      : []
  );

  // قفل خالی‌فروشی — کسریِ زنده فقط برای سفارش‌های خالی‌فروشیِ پیش از ارسال
  // چک می‌شود؛ همه شناسه‌ها با دو کوئری دسته‌ای حل می‌شوند (بدون N+1).
  const fulfillmentRows = rows.filter(
    (row) => row.oversell && (row.status === 'paid' || row.status === 'boxing')
  );
  const productIds = new Set<string>();
  const variantIds = new Set<string>();
  const linesByOrder = new Map<string, ReturnType<typeof parseOrderLinesWithIds>>();
  for (const row of fulfillmentRows) {
    const lines = parseOrderLinesWithIds(row.itemsJson);
    linesByOrder.set(row.id, lines);
    for (const line of lines) {
      if (line.variantId) {
        variantIds.add(line.variantId);
      } else {
        productIds.add(line.productId);
      }
    }
  }
  const [products, variants] = await Promise.all([
    productIds.size > 0
      ? prisma.product.findMany({
          where: { id: { in: [...productIds] } },
          select: { id: true, qty: true },
        })
      : Promise.resolve([] as { id: string; qty: number }[]),
    variantIds.size > 0
      ? prisma.productVariant.findMany({
          where: { id: { in: [...variantIds] } },
          select: { id: true, qty: true },
        })
      : Promise.resolve([] as { id: string; qty: number }[]),
  ]);
  const blockedByOrder = new Map<string, boolean>();
  for (const [orderId, lines] of linesByOrder) {
    blockedByOrder.set(
      orderId,
      lines.some((line) => {
        const qty = line.variantId
          ? variants.find((row) => row.id === line.variantId)?.qty
          : products.find((row) => row.id === line.productId)?.qty;
        return qty != null && qty < 0;
      })
    );
  }

  return rows.map((row) => ({
    id: row.displayId,
    customer: row.customer,
    date: row.date,
    createdAt: row.createdAt,
    amount: row.amount,
    status: toStatus(row.status),
    trackingCode: row.trackingCode,
    notified: row.notifiedAt !== null,
    phone: (row.userId && phones.get(row.userId)) || null,
    items: parseOrderItems(row.itemsJson),
    oversell: row.oversell,
    oversellBlocked: blockedByOrder.get(row.id) ?? false,
    shopNote: row.shopNote,
  }));
}

export async function countOrders(): Promise<number> {
  return prisma.order.count();
}
