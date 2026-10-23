/**
 * Customers: the registered accounts with role 'customer' — the same users
 * who sign up in the storefront. Orders count and total spend are computed
 * live from the Order table; the tier badge is derived from spend.
 *
 * The customer *file* (getCustomerFile) is the read-only 360° view a supporter
 * or an admin opens from the customer list or from inside a support ticket:
 * the account, plus every trace it left — orders, wallet, gateway attempts,
 * tickets, burned coupons and saved addresses. It writes nothing.
 */

import prisma from './db';
import { faCurrency, faJalaliDate, faPercent, fromFaDigits } from './format';
import type { OrderStatus } from './order-status';
import { listCustomerOrders, parseItems, type CustomerOrder } from './shop-orders';
import { listTicketsForCustomer, type SupportTicketDTO } from './support';
import { hashPassword } from './users';
import {
  listOnlinePayments,
  listWalletTransactions,
  PAYMENT_KIND_LABELS,
  PAYMENT_STATE_LABELS,
  WALLET_TX_LABELS,
  type OnlinePaymentDTO,
  type WalletTransactionDTO,
  type WalletTxType,
} from './wallet';

/** One recent order shown in the customer's detail modal. */
export interface CustomerOrderSummary {
  displayId: string;
  date: string;
  amount: number;
  status: OrderStatus;
}

/** The customer's unpaid order — their de-facto active basket. */
export interface CustomerBasket {
  displayId: string;
  amount: number;
  items: { name: string; qty: number }[];
}

export interface Customer {
  id: string;
  name: string;
  /** Iranian mobile number — the customer's username. */
  phone: string;
  /** Two-letter avatar initials. */
  initials: string;
  orders: number;
  /** Total paid+pending order value in Toman. */
  spent: number;
  tier: 'طلایی' | 'نقره‌ای' | 'برنزی';
  /** Pre-formatted Jalali sign-up date. */
  since: string;
  /** Latest orders, newest first (capped for the modal). */
  recentOrders: CustomerOrderSummary[];
  /** The pending (unpaid) order holding the customer's current basket. */
  basket: CustomerBasket | null;
  /** Wallet balance in Toman — admin can adjust it with a reason. */
  walletBalance: number;
  /** True when the admin blocked the account — login is refused while set. */
  isBlocked: boolean;
}

/** Spend thresholds (Toman) driving the tier badge. */
const GOLD_THRESHOLD = 100_000_000;
const SILVER_THRESHOLD = 50_000_000;

/** How many recent orders the detail modal lists. */
const RECENT_ORDERS_LIMIT = 5;

/** How many ledger/payment rows the customer file carries. */
const FILE_LEDGER_LIMIT = 50;

/* ---------------------------------------------------------------------------
 * The customer file (پروندهٔ مشتری) — the full, read-only activity record.
 * ------------------------------------------------------------------------ */

/** One order with its lines, as shown in the file's orders section. */
export interface CustomerFileOrder {
  id: string;
  displayId: string;
  date: string;
  amount: number;
  status: OrderStatus;
  trackingCode: string | null;
  /** Snapshot of the lines at order time — see Order.itemsJson. */
  items: { name: string; qty: number; unitPrice: number }[];
  /** True for the unpaid order holding the customer's current basket. */
  isBasket: boolean;
}

/** One wallet-ledger row, label already resolved to Persian. */
export interface CustomerFileWalletLine {
  id: string;
  label: string;
  /** Signed Toman: positive = credit, negative = debit. */
  amount: number;
  reason: string | null;
  date: string;
}

/** One gateway attempt, labels already resolved to Persian. */
export interface CustomerFilePayment {
  id: string;
  kindLabel: string;
  stateLabel: string;
  state: OnlinePaymentDTO['state'];
  amount: number;
  refId: string | null;
  orderDisplayId: string | null;
  date: string;
}

/** One support conversation this customer opened. */
export interface CustomerFileTicket {
  id: string;
  displayId: string;
  subject: string;
  status: SupportTicketDTO['status'];
  lastMessageDate: string;
  /** Requester side is newer than our read — «جدید» in the panel. */
  unread: boolean;
}

/** One coupon this customer has burned. */
export interface CustomerFileCoupon {
  id: string;
  code: string;
  /** Display value, e.g. '٪۱۰' or '۵۰٬۰۰۰ تومان'. */
  valueLabel: string;
  date: string;
}

/** One saved delivery address. */
export interface CustomerFileAddress {
  id: string;
  title: string;
  receiverName: string;
  receiverPhone: string;
  body: string;
  postalCode: string | null;
}

/**
 * Everything the customer file renders. Assembled from the existing list
 * functions so no query is written twice — orders through listCustomerOrders,
 * the ledger through listWalletTransactions, and so on.
 */
export interface CustomerFile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  nationalId: string | null;
  /** Pre-formatted Jalali sign-up date. */
  since: string;
  walletBalance: number;
  isBlocked: boolean;
  /** Orders that are not cancelled — the number the customer card shows. */
  orderCount: number;
  /** Total of those orders, in Toman. */
  spent: number;
  tier: Customer['tier'];
  /** Every order, newest first. */
  orders: CustomerFileOrder[];
  /** Newest ledger rows first, capped at FILE_LEDGER_LIMIT. */
  walletLines: CustomerFileWalletLine[];
  /** Newest gateway attempts first, capped at FILE_LEDGER_LIMIT. */
  payments: CustomerFilePayment[];
  /** Support conversations, newest activity first. */
  tickets: CustomerFileTicket[];
  /** Coupons the customer has used, newest first. */
  coupons: CustomerFileCoupon[];
  addresses: CustomerFileAddress[];
}

function tierFor(spent: number): Customer['tier'] {
  if (spent >= GOLD_THRESHOLD) {
    return 'طلایی';
  }
  return spent >= SILVER_THRESHOLD ? 'نقره‌ای' : 'برنزی';
}

/** First two non-space characters of the name, for the avatar. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '؟';
  }
  return parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`;
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

export async function listCustomers(search?: string): Promise<Customer[]> {
  const trimmed = search?.trim();
  // Typed digits may be Persian — normalize so a phone search still matches.
  const normalized = trimmed ? fromFaDigits(trimmed) : '';

  const users = await prisma.user.findMany({
    where: trimmed
      ? {
          role: 'customer',
          OR: [{ name: { contains: trimmed } }, { phone: { contains: normalized } }],
        }
      : { role: 'customer' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      phone: true,
      createdAt: true,
      walletBalance: true,
      isBlocked: true,
    },
  });

  // Orders for exactly these customers (one query, no N+1).
  const orders = await prisma.order.findMany({
    where: { userId: { in: users.map((user) => user.id) } },
    orderBy: { createdAt: 'desc' },
    select: {
      userId: true,
      displayId: true,
      date: true,
      amount: true,
      status: true,
      itemsJson: true,
    },
  });

  const byUser = new Map<string, typeof orders>();
  for (const order of orders) {
    if (!order.userId) {
      continue;
    }
    const list = byUser.get(order.userId) ?? [];
    list.push(order);
    byUser.set(order.userId, list);
  }

  return users.map((user) => {
    const userOrders = byUser.get(user.id) ?? [];
    const active = userOrders.filter((order) => order.status !== 'cancelled');
    const pending = userOrders.find((order) => order.status === 'pending') ?? null;

    return {
      id: user.id,
      name: user.name,
      phone: user.phone ?? '—',
      initials: initialsOf(user.name),
      orders: active.length,
      spent: active.reduce((sum, order) => sum + order.amount, 0),
      tier: tierFor(active.reduce((sum, order) => sum + order.amount, 0)),
      since: faJalaliDate(user.createdAt),
      recentOrders: userOrders.slice(0, RECENT_ORDERS_LIMIT).map((order) => ({
        displayId: order.displayId,
        date: order.date,
        amount: order.amount,
        status: toStatus(order.status),
      })),
      basket: pending
        ? {
            displayId: pending.displayId,
            amount: pending.amount,
            items: parseItems(pending.itemsJson).map((item) => ({
              name: item.name,
              qty: item.qty,
            })),
          }
        : null,
      walletBalance: user.walletBalance,
      isBlocked: user.isBlocked,
    };
  });
}

export async function countCustomers(): Promise<number> {
  return prisma.user.count({ where: { role: 'customer' } });
}

/** Persian label for a burned coupon, e.g. '٪۱۰' or '۵۰٬۰۰۰ تومان'. */
function couponValueLabel(type: string, value: number): string {
  return type === 'percent' ? faPercent(value, { fractionDigits: 0 }) : faCurrency(value, false);
}

/**
 * The full activity record of one customer — the page behind
 * «مشاهدهٔ پروندهٔ مشتری», reachable both from the customer list and from
 * inside a support ticket (see canAccessCustomerFile in lib/auth.ts).
 *
 * Returns null when the id is unknown *or* belongs to a staff account: only
 * real customers have a file, and a supporter must never land on a colleague's
 * record by guessing an id.
 *
 * Read-only throughout. Every section reuses the list function the matching
 * panel page already renders, so a supporter sees the same numbers the
 * customers/orders/wallet pages show — no second, drifting definition.
 */
export async function getCustomerFile(id: string): Promise<CustomerFile | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      nationalId: true,
      role: true,
      createdAt: true,
      walletBalance: true,
      isBlocked: true,
    },
  });

  if (!user || user.role !== 'customer') {
    return null;
  }

  const [orders, ledger, payments, tickets, redemptions, addresses] = await Promise.all([
    listCustomerOrders(user.id),
    listWalletTransactions(user.id),
    listOnlinePayments(user.id),
    listTicketsForCustomer(user.id),
    prisma.couponRedemption.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { coupon: { select: { code: true, type: true, value: true } } },
    }),
    prisma.address.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
  ]);

  const active = orders.filter((order) => order.status !== 'cancelled');
  const spent = active.reduce((sum, order) => sum + order.amount, 0);

  return {
    id: user.id,
    name: user.name,
    phone: user.phone ?? '—',
    email: user.email,
    nationalId: user.nationalId,
    since: faJalaliDate(user.createdAt),
    walletBalance: user.walletBalance,
    isBlocked: user.isBlocked,
    orderCount: active.length,
    spent,
    tier: tierFor(spent),
    orders: orders.map((order: CustomerOrder) => ({
      id: order.id,
      displayId: order.displayId,
      date: order.date,
      amount: order.amount,
      status: order.status,
      trackingCode: order.trackingCode,
      items: order.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
      })),
      isBasket: order.status === 'pending',
    })),
    walletLines: ledger.slice(0, FILE_LEDGER_LIMIT).map((row: WalletTransactionDTO) => ({
      id: row.id,
      label: WALLET_TX_LABELS[row.type as WalletTxType] ?? row.type,
      amount: row.amount,
      reason: row.reason,
      date: row.date,
    })),
    payments: payments.slice(0, FILE_LEDGER_LIMIT).map((row: OnlinePaymentDTO) => ({
      id: row.id,
      kindLabel: PAYMENT_KIND_LABELS[row.kind],
      stateLabel: PAYMENT_STATE_LABELS[row.state],
      state: row.state,
      amount: row.amount,
      refId: row.refId,
      orderDisplayId: row.orderDisplayId,
      date: row.date,
    })),
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      displayId: ticket.displayId,
      subject: ticket.subject,
      status: ticket.status,
      lastMessageDate: ticket.lastMessageDate,
      unread: ticket.unread,
    })),
    coupons: redemptions.map((row) => ({
      id: row.id,
      code: row.coupon.code,
      valueLabel: couponValueLabel(row.coupon.type, row.coupon.value),
      date: faJalaliDate(row.createdAt),
    })),
    addresses: addresses.map((address) => ({
      id: address.id,
      title: address.title,
      receiverName: address.receiverName,
      receiverPhone: address.receiverPhone,
      body: address.body,
      postalCode: address.postalCode,
    })),
  };
}

/**
 * Blocks or unblocks a customer account. A blocked customer is refused at
 * sign-in until unblocked; only rows that really are customers are touched.
 * Returns false when the id is not a customer.
 */
export async function setCustomerBlocked(id: string, blocked: boolean): Promise<boolean> {
  const result = await prisma.user.updateMany({
    where: { id, role: 'customer' },
    data: { isBlocked: blocked },
  });
  return result.count > 0;
}

/**
 * Admin-side password reset (مشتریان ← بازنشانی رمز عبور): sets a brand-new
 * salt + hash, exactly like the customer's own reset flow. Any pending SMS
 * reset code is cleared so an old code can't reclaim the account afterwards.
 * Returns false when the id is not a customer or the password is too short.
 */
export async function resetCustomerPassword(
  id: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 8) {
    return { ok: false, error: 'گذرواژه باید حداقل ۸ نویسه باشد.' };
  }

  const user = await prisma.user.findFirst({ where: { id, role: 'customer' } });
  if (!user) {
    return { ok: false, error: 'مشتری یافت نشد.' };
  }

  const salt = crypto.randomUUID();
  const passwordHash = await hashPassword(newPassword, salt);

  await prisma.user.update({
    where: { id: user.id },
    data: { salt, passwordHash, resetCodeHash: null, resetCodeExpiresAt: null },
  });

  return { ok: true };
}
