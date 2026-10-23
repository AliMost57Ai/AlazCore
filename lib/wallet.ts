/**
 * Wallet domain logic: the ledger behind User.walletBalance and the shared
 * "pay an order from the wallet" step used by both the checkout route (instant
 * payment when the balance covers it) and the payment callback (auto-pay after
 * a gateway top-up).
 *
 * Server-only — imports lib/db.
 */

import type { Prisma } from './generated/prisma/client';
import prisma from './db';
import { faJalaliDate } from './format';
import {
  PAYMENT_KIND_LABELS as _KIND_LABELS,
  PAYMENT_STATE_LABELS as _STATE_LABELS,
} from './payment-defs';

/** What kind of movement a ledger row records. */
export type WalletTxType = 'charge' | 'order_payment' | 'refund' | 'admin_adjust';

/** Persian labels for the ledger rows — rendered on the wallet page. */
export const WALLET_TX_LABELS: Record<WalletTxType, string> = {
  charge: 'شارژ کیف پول',
  order_payment: 'پرداخت سفارش',
  refund: 'بازگشت وجه',
  admin_adjust: 'تعدیل توسط فروشگاه',
};

export interface WalletTransactionDTO {
  id: string;
  type: WalletTxType;
  /** Signed Toman: positive = credit, negative = debit. */
  amount: number;
  reason: string | null;
  orderId: string | null;
  date: string;
}

/** Shape handed to the wallet page. */
export interface OnlinePaymentDTO {
  id: string;
  kind: 'wallet_charge' | 'order_payment';
  amount: number;
  state: 'pending' | 'verified' | 'failed';
  refId: string | null;
  /** The tied order's human-facing id, when the attempt belongs to one. */
  orderDisplayId: string | null;
  date: string;
}

/** Persian labels moved to client-safe lib/payment-defs.ts. */
export { PAYMENT_KIND_LABELS, PAYMENT_STATE_LABELS } from './payment-defs';

void _KIND_LABELS;
void _STATE_LABELS;

type Tx = Prisma.TransactionClient;

function toTxType(value: string): WalletTxType {
  return value === 'charge' ||
    value === 'order_payment' ||
    value === 'refund' ||
    value === 'admin_adjust'
    ? value
    : 'admin_adjust';
}

/** Credits the wallet and appends the ledger row — inside a transaction. */
export async function creditWallet(
  tx: Tx,
  input: { userId: string; amount: number; type: WalletTxType; reason?: string; orderId?: string }
): Promise<void> {
  await tx.user.update({
    where: { id: input.userId },
    data: { walletBalance: { increment: input.amount } },
  });
  await tx.walletTransaction.create({
    data: {
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      reason: input.reason ?? null,
      orderId: input.orderId ?? null,
    },
  });
}

/**
 * Debits the wallet, but only when the balance actually covers the amount:
 * the conditional update matches zero rows otherwise, so two concurrent
 * payments can never overdraw the wallet. Returns false when it didn't fit.
 */
export async function debitWallet(
  tx: Tx,
  input: { userId: string; amount: number; type: WalletTxType; reason?: string; orderId?: string }
): Promise<boolean> {
  const updated = await tx.user.updateMany({
    where: { id: input.userId, walletBalance: { gte: input.amount } },
    data: { walletBalance: { decrement: input.amount } },
  });
  if (updated.count === 0) {
    return false;
  }

  await tx.walletTransaction.create({
    data: {
      userId: input.userId,
      type: input.type,
      amount: -input.amount,
      reason: input.reason ?? null,
      orderId: input.orderId ?? null,
    },
  });
  return true;
}

export async function getWalletBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletBalance: true },
  });
  return user?.walletBalance ?? 0;
}

/**
 * Pays a pending order from the wallet — the single commit point every
 * payment path funnels through: debits the wallet, marks the order paid,
 * records the ledger + payment-attempt rows and burns the coupon use.
 *
 * Returns false when the balance didn't cover the payable amount (nothing is
 * written in that case). Expects the caller to have computed and stored the
 * coupon discount on the order already.
 */
export async function payOrderFromWallet(
  tx: Tx,
  input: {
    order: { id: string; displayId: string; userId: string | null; couponCode: string | null };
    payable: number;
    /** Gateway ref id when this payment settles a gateway top-up. */
    refId?: string | null;
  }
): Promise<boolean> {
  if (!input.order.userId) {
    return false;
  }

  const paid = await debitWallet(tx, {
    userId: input.order.userId,
    amount: input.payable,
    type: 'order_payment',
    reason: `پرداخت سفارش ${input.order.displayId}`,
    orderId: input.order.id,
  });
  if (!paid) {
    return false;
  }

  await tx.order.update({
    where: { id: input.order.id },
    data: { status: 'paid', paidAt: new Date(), paymentRefId: input.refId ?? null },
  });

  await tx.onlinePaymentTransaction.create({
    data: {
      userId: input.order.userId,
      kind: 'order_payment',
      amount: input.payable,
      state: 'verified',
      refId: input.refId ?? null,
      orderId: input.order.id,
    },
  });

  if (input.order.couponCode) {
    const coupon = await tx.coupon.findUnique({
      where: { code: input.order.couponCode },
      select: { id: true },
    });
    if (coupon) {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });
      // Single use per customer — upsert so a retry after a partial failure
      // can never throw on the unique constraint.
      await tx.couponRedemption.upsert({
        where: {
          couponId_userId: { couponId: coupon.id, userId: input.order.userId },
        },
        create: {
          couponId: coupon.id,
          userId: input.order.userId,
          orderId: input.order.id,
        },
        update: {},
      });
    }
  }

  return true;
}

/** One payment attempt as the admin payments page shows it. */
export interface AdminOnlinePaymentDTO {
  id: string;
  kind: 'wallet_charge' | 'order_payment';
  amount: number;
  state: 'pending' | 'verified' | 'failed';
  /** Gateway id — which IPG/BNPL the attempt went through. */
  gateway: string;
  /** ZarinPal reference number after a successful verify. */
  refId: string | null;
  /** Gateway authority of the attempt, when it went through one. */
  authority: string | null;
  /** شماره کارت ماسک‌شده از پاسخ verify (وقتی درگاه بفرستد). */
  cardPan: string | null;
  /** سایر اطلاعات تأیید درگاه (کارمزد/…) — JSON ذخیره‌شده در callback. */
  verifyInfo: Record<string, string>;
  /** The tied order's human-facing id, when the attempt belongs to one. */
  orderDisplayId: string | null;
  userName: string;
  userPhone: string | null;
  date: string;
}

/** Every customer's payment attempts, newest first — the admin list. */
export async function listAllOnlinePayments(): Promise<AdminOnlinePaymentDTO[]> {
  const rows = await prisma.onlinePaymentTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { name: true, phone: true } } },
  });

  // Resolve the tied orders' display ids in one batch.
  const orderIds = [
    ...new Set(rows.map((row) => row.orderId).filter((id): id is string => Boolean(id))),
  ];
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, displayId: true },
  });
  const displayIds = new Map(orders.map((order) => [order.id, order.displayId]));

  return rows.map((row) => {
    // JSON ذخیره‌شده در callback — ردیف‌های خراب/قدیمی بی‌صدا خالی می‌مانند.
    let verifyInfo: Record<string, string> = {};
    try {
      const parsed: unknown = row.verifyPayload ? JSON.parse(row.verifyPayload) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        verifyInfo = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
            .map(([key, value]) => [key, String(value)])
        );
      }
    } catch {
      // بدنه غیر JSON — همان خالی نمایش داده می‌شود.
    }
    return {
      id: row.id,
      kind: row.kind === 'order_payment' ? 'order_payment' : 'wallet_charge',
      amount: row.amount,
      state: row.state === 'verified' || row.state === 'failed' ? row.state : 'pending',
      gateway: row.gateway,
      refId: row.refId,
      authority: row.authority,
      cardPan: row.cardPan,
      verifyInfo,
      orderDisplayId: row.orderId ? (displayIds.get(row.orderId) ?? null) : null,
      userName: row.user.name,
      userPhone: row.user.phone,
      date: faJalaliDate(row.createdAt),
    };
  });
}

/** The customer's wallet ledger, newest first. */
export async function listWalletTransactions(userId: string): Promise<WalletTransactionDTO[]> {
  const rows = await prisma.walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return rows.map((row) => ({
    id: row.id,
    type: toTxType(row.type),
    amount: row.amount,
    reason: row.reason,
    orderId: row.orderId,
    date: faJalaliDate(row.createdAt),
  }));
}

/** The customer's payment-attempt history, newest first. */
export async function listOnlinePayments(userId: string): Promise<OnlinePaymentDTO[]> {
  const rows = await prisma.onlinePaymentTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // Resolve the tied orders' display ids in one batch.
  const orderIds = [
    ...new Set(rows.map((row) => row.orderId).filter((id): id is string => Boolean(id))),
  ];
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, displayId: true },
  });
  const displayIds = new Map(orders.map((order) => [order.id, order.displayId]));

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind === 'order_payment' ? 'order_payment' : 'wallet_charge',
    amount: row.amount,
    state: row.state === 'verified' || row.state === 'failed' ? row.state : 'pending',
    refId: row.refId,
    orderDisplayId: row.orderId ? (displayIds.get(row.orderId) ?? null) : null,
    date: faJalaliDate(row.createdAt),
  }));
}
