/**
 * Orders: DB queries plus the UI constants that used to live in lib/data.ts.
 */

import type { Prisma } from '@prisma/client';
import prisma from './db';
import { fromFaDigits } from './format';
import { STATUS_COLORS, STATUS_LABELS, type OrderStatus } from './order-status';

export { type OrderStatus, STATUS_LABELS, STATUS_COLORS };

export interface Order {
  id: string;
  customer: string;
  /** Pre-formatted Jalali date string (see prisma/schema.prisma). */
  date: string;
  amount: number;
  status: OrderStatus;
  trackingCode: string | null;
  /** Whether the shipping-notice SMS has been sent to the customer. */
  notified: boolean;
  /** The customer's registered phone when the order is tied to an account. */
  phone: string | null;
}

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

  const search = filters.search?.trim();
  if (search) {
    // Typed digits may be Persian — normalize so ids and phones still match.
    const normalized = fromFaDigits(search);
    const or: Prisma.OrderWhereInput[] = [
      { displayId: { contains: normalized } },
      { customer: { contains: search } },
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

  return rows.map((row) => ({
    id: row.displayId,
    customer: row.customer,
    date: row.date,
    amount: row.amount,
    status: toStatus(row.status),
    trackingCode: row.trackingCode,
    notified: row.notifiedAt !== null,
    phone: (row.userId && phones.get(row.userId)) || null,
  }));
}

export async function countOrders(): Promise<number> {
  return prisma.order.count();
}
