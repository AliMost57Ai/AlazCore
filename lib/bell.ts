/**
 * شمارنده‌های زنگ‌اخبار داشبورد فروشگاه — تک منبع محاسبه برای layout سروری و
 * API polling زنده (/api/notifications) تا هر دو همیشه یک عدد ببینند.
 *
 * همه‌ی شمارنده‌ها از دیتابیس همین سایت می‌آیند (بدون عدد ثابت) و بج‌های منو
 * همان تعریف مشتق «نخوانده» را دارند — هیچ‌کدام شمارنده ذخیره‌شده نیستند.
 */

import prisma from './db';
import { listUnreadForStaff } from './customer-tickets';
import { isInPersonDeliveryEnabled } from './core-license';
import { pickupCounts } from './pickup';
import { lowStockList, oversellList, reorderList } from './stock';

/** شمارهای زنگ هدر داشبورد — آینه BellMenu. */
export interface BellNotifications {
  /** تیکت‌های باز پشتیبانی مشتریان (منتظر پاسخ مالک). */
  support: number;
  /** کالاهای در وضعیت خالی‌فروشی (موجودی صفر/منفی با مجوز). */
  oversell: number;
  /** کالاهای رسیده به نقطه سفارش (لیست خرید). */
  reorder: number;
  /** کالاهای رو به اتمام (حداقل موجودی). */
  lowStock: number;
  /** تحویل حضوری — رزروهای فعال (پرداخت‌شده، منتظر مراجعه). */
  pickupReserved?: number;
  /** تحویل حضوری — تحویل‌شده‌ها (به تفکیک از رزروها). */
  pickupDelivered?: number;
}

/** خروجی یک poll زنگ‌اخبار — بج منو + شمارهای زنگ، از یک جا. */
export interface BellSnapshot {
  badges: Record<string, number>;
  notifications: BellNotifications;
}

/** آخرین تیکت نخوانده پشتیبان — برای متن اعلان «تیکت جدید». */
export interface LatestUnreadTicket {
  displayId: string;
  subject: string;
  requesterName: string;
}

/**
 * همه‌ی شمارنده‌های زنگ + بج منو در یک دسته — همان محاسباتی که layout پنل
 * (app) انجام می‌داد.
 */
export async function collectBellSnapshot(): Promise<BellSnapshot> {
  const pickupEnabled = await isInPersonDeliveryEnabled();
  const [totalOrders, reorder, lowStock, oversell, unreadTickets, pickup] = await Promise.all([
    prisma.order.count(),
    reorderList(),
    lowStockList(),
    oversellList(),
    listUnreadForStaff(),
    pickupEnabled ? pickupCounts() : Promise.resolve({ reserved: 0, delivered: 0 }),
  ]);

  const notifications: BellNotifications = {
    support: unreadTickets.length,
    oversell: oversell.length,
    reorder: reorder.length,
    lowStock: lowStock.length,
    ...(pickupEnabled
      ? { pickupReserved: pickup.reserved, pickupDelivered: pickup.delivered }
      : {}),
  };

  const badges: Record<string, number> = {
    '/orders': totalOrders,
    '/products/reorder-list': reorder.length,
    '/products/low-stock': lowStock.length,
    '/products/oversell': oversell.length,
    ...(pickupEnabled ? { '/orders/pickup': pickup.reserved } : {}),
    '/customer-support': notifications.support,
  };

  return { badges, notifications };
}

/** آخرین تیکت در انتظار پشتیبان برای متن اعلان زنده — null اگر چیزی نیست. */
export async function latestUnreadSupportTicket(): Promise<LatestUnreadTicket | null> {
  const unread = await listUnreadForStaff();
  const latest = unread[0];
  if (!latest) {
    return null;
  }
  return {
    displayId: latest.displayId,
    subject: latest.subject,
    requesterName: latest.requesterName,
  };
}
