/**
 * جریان وضعیت تیکت — خالص و بدون وابستگی تا با jest تست شود و در همه
 * APIهای تیکت (هر دو اپ shop/core) یکسان مصرف شود. آینه lib/ticket-flow.ts.
 *
 * واژه‌نامه مرجع (TicketingSys) سه وضعیت دارد:
 *  - پیامِ سمت درخواست‌کننده (customer/tenant) → open «در انتظار پاسخ»
 *  - پیامِ سمت پشتیبان (owner/core) → answered «پاسخ داده شده»
 * تیکت بسته با پیام باز نمی‌شود؛ بازگشایی فقط اکشن صریح پشتیبان است
 * (setTicketStatus) — APIها پیام روی تیکت بسته را با ۴۰۰ رد می‌کنند و این
 * شاخه closed فقط حفاظ داخلی است.
 */

/** سمت‌هایی که «پاسخ‌دهنده» حساب می‌شوند. */
export const SUPPORTER_SIDES = ['core', 'owner'];

export function isSupporterSide(side: string): boolean {
  return SUPPORTER_SIDES.includes(side);
}

/** وضعیت بعد از ثبت یک پیام — روی تیکت بسته هرگز تغییری نمی‌دهد. */
export function nextTicketStatus(authorSide: string, current: string): string {
  if (current === 'closed') {
    return 'closed';
  }
  return isSupporterSide(authorSide) ? 'answered' : 'open';
}

/** وضعیت بستن صریح — همیشه بسته. */
export function closedStatus(): string {
  return 'closed';
}
