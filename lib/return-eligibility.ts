/**
 * اهلیت مرجوعی سفارش — وضعیت ویندو و درخواست فعال، بر پایه تنظیمات فروشگاه.
 * ماژول مستقل نگه داشته شده تا هم lib/product-returns.ts و هم lib/shop-orders.ts
 * (بدون وابستگی حلقوی) مصرفش کنند.
 */

import prisma from './db';
import { ACTIVE_RETURN_STATUSES } from './return-status';
import { getAppSettings } from './settings';

/** وضعیت مرجوعی یک سفارش از نگاه مشتری — اهلیت درخواست و انقضای ویندو. */
export interface OrderReturnState {
  returnEnabled: boolean;
  windowDays: number;
  windowEndsAt: Date | null;
  hasActiveRequest: boolean;
  canRequest: boolean;
  /** همهٔ درخواست‌های مرجوعی این سفارش، جدیدترین اول — برای تب «مرجوعی»
   *  سفارش‌های من و پیگیری وضعیت روی کارت. displayId برای آدرس‌دهی لینک
   *  (قاعدهٔ پنل: لینک جزئیات فقط displayId، هرگز cuid). */
  requests: { id: string; displayId: string; status: string; createdAt: Date }[];
}

/** مبنای ویندوی مرجوعی — تحویل، و برای ردیف‌های قدیمی پرداخت/ثبت سفارش. */
export function returnWindowAnchor(order: {
  deliveredAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}): Date {
  return order.deliveredAt ?? order.paidAt ?? order.createdAt;
}

/** وضعیت مرجوعیِ یک دسته سفارش — یک کوئری تنظیمات + یک کوئری درخواست فعال. */
export async function getOrdersReturnState(
  orders: Array<{
    id: string;
    status: string;
    deliveredAt: Date | null;
    paidAt: Date | null;
    createdAt: Date;
  }>
): Promise<Map<string, OrderReturnState>> {
  const result = new Map<string, OrderReturnState>();
  if (orders.length === 0) {
    return result;
  }

  const settings = await getAppSettings();
  const windowDays = Math.max(Number(settings.returnWindowDays) || 0, 0);
  const allRequests = await prisma.returnRequest.findMany({
    where: { orderId: { in: orders.map((order) => order.id) } },
    select: { id: true, displayId: true, orderId: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  const requestsByOrder = new Map<
    string,
    { id: string; displayId: string; status: string; createdAt: Date }[]
  >();
  for (const row of allRequests) {
    const list = requestsByOrder.get(row.orderId) ?? [];
    list.push({ id: row.id, displayId: row.displayId, status: row.status, createdAt: row.createdAt });
    requestsByOrder.set(row.orderId, list);
  }
  const activeStatuses = new Set<string>(ACTIVE_RETURN_STATUSES);

  for (const order of orders) {
    const windowEndsAt = new Date(
      returnWindowAnchor(order).getTime() + windowDays * 24 * 60 * 60 * 1000
    );
    const requests = requestsByOrder.get(order.id) ?? [];
    const hasActiveRequest = requests.some((request) => activeStatuses.has(request.status));
    const canRequest =
      settings.returnEnabled &&
      order.status === 'delivered' &&
      windowDays > 0 &&
      windowEndsAt.getTime() >= Date.now() &&
      !hasActiveRequest;
    result.set(order.id, {
      returnEnabled: settings.returnEnabled,
      windowDays,
      windowEndsAt,
      hasActiveRequest,
      canRequest,
      requests,
    });
  }
  return result;
}
