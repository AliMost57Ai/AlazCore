/**
 * Customers: the registered accounts with role 'customer' — the same users
 * who sign up in the storefront. Orders count and total spend are computed
 * live from the Order table; the tier badge is derived from spend.
 */

import { listTicketsForCustomer } from './customer-tickets';
import prisma from './db';
import { faCurrency, faJalaliDate, faPercent, fromFaDigits } from './format';
import type { OrderStatus } from './order-status';
import { PAYMENT_KIND_LABELS, PAYMENT_STATE_LABELS } from './payment-defs';
import { listCustomerReturns } from './product-returns';
import { listCustomerOrders, parseItems } from './shop-orders';
import { hashPassword } from './users';
import {
  listOnlinePayments,
  listWalletTransactions,
  WALLET_TX_LABELS,
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

/* ---------------------------------------------------------------------------
 * پروندهٔ مشتری — سابقهٔ کامل و فقط-خواندنی یک مشتری؛ صفحه پشت «مشاهدهٔ
 * پروندهٔ مشتری»، هم از لیست مشتریان و هم از داخل تیکت پشتیبانی در دسترس است
 * (canAccessCustomerFile در lib/auth.ts).
 * ------------------------------------------------------------------------ */

/** چند ردیف دفتری (کیف پول/درگاه) پرونده حمل می‌کند. */
const FILE_LEDGER_LIMIT = 50;

/** یک سفارش در بخش سفارش‌های پرونده. */
export interface CustomerFileOrder {
  id: string;
  displayId: string;
  date: string;
  amount: number;
  status: OrderStatus;
  trackingCode: string | null;
  /** اسنپ‌شات اقلام هنگام ثبت سفارش — Order.itemsJson. */
  items: { name: string; qty: number; unitPrice: number }[];
  /** سبد پرداخت‌نشدهٔ فعال = status 'pending'. */
  isBasket: boolean;
}

export interface CustomerFileWalletLine {
  id: string;
  label: string;
  amount: number;
  reason: string | null;
  date: string;
}

export interface CustomerFilePayment {
  id: string;
  kindLabel: string;
  stateLabel: string;
  state: 'pending' | 'verified' | 'failed';
  amount: number;
  refId: string | null;
  orderDisplayId: string | null;
  date: string;
}

export interface CustomerFileTicket {
  id: string;
  displayId: string;
  subject: string;
  status: string;
  lastMessageDate: string;
  unread: boolean;
}

export interface CustomerFileCoupon {
  id: string;
  code: string;
  valueLabel: string;
  date: string;
}

export interface CustomerFileAddress {
  id: string;
  title: string;
  receiverName: string;
  receiverPhone: string;
  body: string;
  postalCode: string | null;
}

/** یک درخواست مرجوعی مشتری در پرونده — آخرین ردیف‌ها. */
export interface CustomerFileReturn {
  id: string;
  displayId: string;
  orderDisplayId: string;
  dateLabel: string;
  /** مبلغ نهایی واریزشده برای تسویه‌شده‌ها، وگرنه مبلغ بازگشتی اقلام. */
  amount: number;
  status: string;
}

export interface CustomerFile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  nationalId: string | null;
  /** تاریخ عضویت (جلالی). */
  since: string;
  walletBalance: number;
  isBlocked: boolean;
  /** سفارش‌های غیرلغوشده. */
  orderCount: number;
  /** جمع سفارش‌های غیرلغوشده. */
  spent: number;
  tier: Customer['tier'];
  orders: CustomerFileOrder[];
  returns: CustomerFileReturn[];
  walletLines: CustomerFileWalletLine[];
  payments: CustomerFilePayment[];
  tickets: CustomerFileTicket[];
  coupons: CustomerFileCoupon[];
  addresses: CustomerFileAddress[];
}

/** برچسب فارسی کوپن سوخته‌شده، مثل «٪۱۰» یا «۵۰٬۰۰۰ تومان». */
function couponValueLabel(type: string, value: number): string {
  return type === 'percent' ? faPercent(value, { fractionDigits: 0 }) : faCurrency(value, false);
}

/**
 * سابقهٔ کامل یک مشتری — همه بخش‌ها همان تابع لیستِ صفحه متناظر پنل را صدا
 * می‌زنند تا پشتیبان همان عددهایی را ببیند که صفحات سفارش/کیف پول نشان می‌دهند؛
 * تعریف دومِ واگرا شکل نمی‌گیرد.
 *
 * برای id ناموجود *یا* حساب پرسنلی null برمی‌گردد: فقط مشتری واقعی پرونده
 * دارد و پشتیبان نباید با حدس زدن id به رکورد هم‌کارش برسد. سرتاسر
 * فقط-خواندنی — هر تغییری در صفحه مالکِ خودش با گارد خودش می‌ماند.
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

  const [orders, returns, ledger, payments, tickets, redemptions, addresses] = await Promise.all([
    listCustomerOrders(user.id),
    listCustomerReturns(user.id),
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
    orders: orders.map((order) => ({
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
    returns: returns.slice(0, FILE_LEDGER_LIMIT).map((row) => ({
      id: row.id,
      displayId: row.displayId,
      orderDisplayId: row.orderDisplayId,
      dateLabel: faJalaliDate(row.createdAt),
      amount: row.refundedAmount ?? row.refundItemsAmount,
      status: row.status,
    })),
    walletLines: ledger.slice(0, FILE_LEDGER_LIMIT).map((row) => ({
      id: row.id,
      label: WALLET_TX_LABELS[row.type as WalletTxType] ?? row.type,
      amount: row.amount,
      reason: row.reason,
      date: row.date,
    })),
    payments: payments.slice(0, FILE_LEDGER_LIMIT).map((row) => ({
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
