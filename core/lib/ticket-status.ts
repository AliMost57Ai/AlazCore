/**
 * واژه‌نامه وضعیت تیکت و قاعده خوانده/نخوانده — آینه lib/ticket-status.ts
 * (پورت lib/support-status.ts نسخه مرجع به‌صورت ساید-آگنوستیک): همان تعریف
 * برای جفت مالک سایت ↔ پشتیبان کور.
 *
 * عمداً بدون Prisma و React است تا ماژول دامین، پنل کور و هر کلاینتی یک
 * تعریف واحد از «خوانده‌نشده» داشته باشند. خوانده/نخوانده «مشتق» است، هرگز
 * شمارنده ذخیره‌شده نیست.
 */

import { isSupporterSide } from './ticket-flow';

/** 'open' (در انتظار پاسخ) | 'answered' | 'closed' */
export type TicketStatus = 'open' | 'answered' | 'closed';

/** برچسب فارسی بج وضعیت. */
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'در انتظار پاسخ',
  answered: 'پاسخ داده شده',
  closed: 'بسته',
};

/** رنگ بج وضعیت در Mantine. */
export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'orange',
  answered: 'teal',
  closed: 'gray',
};

/** هر مقدار ذخیره‌شده به یک وضعیت شناخته‌شده می‌خواند — pending نسخه‌های قدیمی هم open است. */
export function toTicketStatus(value: string): TicketStatus {
  return value === 'answered' || value === 'closed' ? value : 'open';
}

/** نقش یک سمتِ پیام نسبت به دو طرف گفتگو. */
export type TicketSideRole = 'requester' | 'supporter';

/** side خام پیام (customer/owner/tenant/core) → requester یا supporter. */
export function sideRoleOf(authorSide: string): TicketSideRole {
  return isSupporterSide(authorSide) ? 'supporter' : 'requester';
}

/** حداقل چیزی که یک تیکت برای قاعده نخوانده باید در معرض بگذارد. */
export interface TicketUnreadFacts {
  /** زمان آخرین پیام رشته گفتگو. */
  lastMessageAt: Date | string;
  /** سمتِ نویسنده آخرین پیام (customer/owner/tenant/core). */
  lastMessageAuthor: string;
  /** آخرین بازدید درخواست‌کننده (null = هرگز). */
  requesterReadAt: Date | string | null;
  /** آخرین بازدید پشتیبان (null = هرگز). */
  supporterReadAt: Date | string | null;
}

/** میلی‌ثانیه برای Date، رشته ISO یا DateTime پرisma. */
function time(value: Date | string | null): number {
  if (value === null) {
    return 0;
  }
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * نخوانده برای یک سمت: آخرین پیام از سمت مقابل آمده و بعد از آخرین بازدیدِ
 * همان سمت نوشته شده است. تیکتی که سمت هیچ‌وقت باز نکرده (readAt = null)
 * نخوانده حساب می‌شود.
 */
export function isUnreadForSide(side: TicketSideRole, facts: TicketUnreadFacts): boolean {
  if (sideRoleOf(facts.lastMessageAuthor) === side) {
    return false;
  }
  const readAt = side === 'supporter' ? facts.supporterReadAt : facts.requesterReadAt;
  return time(facts.lastMessageAt) > time(readAt);
}
