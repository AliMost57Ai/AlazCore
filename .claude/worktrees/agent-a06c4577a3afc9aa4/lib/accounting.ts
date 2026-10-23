/**
 * Accounting: the per-order money story for the admin — original (list) price,
 * product discount, coupon discount, what was charged online through the
 * gateway, and what was paid from the wallet balance.
 *
 * Server-only — imports lib/db.
 */

import type { Prisma } from '@prisma/client';
import prisma from './db';
import { fromFaDigits } from './format';
import type { OrderStatus } from './order-status';

export interface OrderAccountDTO {
  id: string;
  displayId: string;
  date: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string | null;
  /** List-price total before product discounts (falls back to amount on
   * legacy rows placed before baseAmount existed). */
  baseAmount: number;
  /** The order's discounted total — what the coupon is judged against. */
  amount: number;
  /** Toman knocked off by product discountPercent at order time. */
  productDiscount: number;
  couponCode: string | null;
  discountAmount: number;
  /** amount − discountAmount + shippingCost: what the customer actually owed. */
  payable: number;
  /** Verified gateway money tied to this order (the shortfall charged online). */
  onlinePaid: number;
  /** The rest of the payable amount, settled from the wallet balance. */
  walletPaid: number;
  /** Refunded back to the wallet when a paid order was cancelled. */
  refunded: number;
} 

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

/**
 * Every account-tied order's payment breakdown, newest first. `search`
 * matches the order id or the customer's name/phone (typed Persian digits
 * are normalized, same as the orders page).
 */
export async function listOrderAccounts(search?: string): Promise<OrderAccountDTO[]> {
  const trimmed = search?.trim();
  const where: Prisma.OrderWhereInput = { userId: { not: null } };

  if (trimmed) {
    // Typed digits may be Persian — normalize so ids and phones still match.
    const normalized = fromFaDigits(trimmed);
    // userId is a plain column (no DB relation), so a name/phone search first
    // resolves the matching users and then matches their orders — same as the
    // orders page.
    const users = await prisma.user.findMany({
      where: {
        OR: [{ name: { contains: trimmed } }, { phone: { contains: normalized } }],
      },
      select: { id: true },
    });
    where.OR = [
      { displayId: { contains: normalized } },
      { customer: { contains: trimmed } },
      ...(users.length > 0 ? [{ userId: { in: users.map((user) => user.id) } }] : []),
    ];
  }

  const rows = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  // Resolve the customers in one batch (userId has no relation to include).
  const userIds = [...new Set(rows.map((row) => row.userId).filter((id): id is string => !!id))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, phone: true },
  });
  const userById = new Map(users.map((user) => [user.id, user]));

  // Verified gateway charges tied to these orders, summed per order in one
  // query — the "online paid" column.
  const charges = await prisma.onlinePaymentTransaction.findMany({
    where: {
      orderId: { in: rows.map((row) => row.id) },
      kind: 'wallet_charge',
      state: 'verified',
    },
    select: { orderId: true, amount: true },
  });
  const onlineByOrder = new Map<string, number>();
  for (const charge of charges) {
    if (charge.orderId) {
      onlineByOrder.set(charge.orderId, (onlineByOrder.get(charge.orderId) ?? 0) + charge.amount);
    }
  }

  return rows.map((row) => {
    // Legacy rows (and pre-column pending orders that later merged) can carry
    // a baseAmount below amount — treat it as unknown rather than a negative
    // discount.
    const base = row.baseAmount >= row.amount ? row.baseAmount : row.amount;
    const payable = row.amount - row.discountAmount + row.shippingCost;
    const paid = row.paidAt !== null;
    const onlinePaid = onlineByOrder.get(row.id) ?? 0;
    const user = row.userId ? userById.get(row.userId) : undefined;

    return {
      id: row.id,
      displayId: row.displayId,
      date: row.date,
      status: toStatus(row.status),
      customerName: user?.name ?? row.customer,
      customerPhone: user?.phone ?? null,
      baseAmount: base,
      amount: row.amount,
      productDiscount: base - row.amount,
      couponCode: row.couponCode,
      discountAmount: row.discountAmount,
      payable,
      onlinePaid: paid ? onlinePaid : 0,
      walletPaid: paid ? Math.max(payable - onlinePaid, 0) : 0,
      refunded: row.status === 'cancelled' && row.paidAt ? payable : 0,
    };
  });
}
