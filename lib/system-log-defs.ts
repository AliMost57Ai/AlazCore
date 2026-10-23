/**
 * Shared, dependency-free definitions for the system-log feature — safe to
 * import from client components (unlike lib/system-logs.ts, which owns the
 * Prisma-backed recording and lives server-side only).
 */

/** 'gateway' | 'sms' | 'shahkar' | 'access' | 'order' */
export type SystemLogKind = 'gateway' | 'sms' | 'shahkar' | 'access' | 'order';

export interface SystemLogDTO {
  id: string;
  kind: SystemLogKind;
  provider: string;
  action: string;
  message: string;
  detail: string;
  /** نام نمایشی انجام‌دهنده — برای رویدادهای دسترسی/سفارش؛ خطاهای زیرساختی خالی. */
  actorName: string;
  /** Pre-formatted Jalali date+time "yyyy/MM/dd HH:mm" (ASCII digits). */
  createdAt: string;
}

/** برچسب فارسی انواع لاگ — فیلتر صفحه و رنگ بج. */
export const KIND_LABELS: Record<SystemLogKind, string> = {
  gateway: 'درگاه پرداخت',
  sms: 'پنل پیامکی',
  shahkar: 'شاهکار',
  access: 'دسترسی و حساب‌ها',
  order: 'سفارش‌ها',
};

/** رنگ بج هر نوع لاگ در جدول. */
export const KIND_COLORS: Record<SystemLogKind, string> = {
  gateway: 'grape',
  sms: 'blue',
  shahkar: 'teal',
  access: 'orange',
  order: 'indigo',
};

/** Persian labels for the log actions. */
export const ACTION_LABELS: Record<string, string> = {
  start: 'شروع پرداخت',
  verify: 'تأیید تراکنش',
  cancel: 'لغو پرداخت در درگاه',
  unknown_callback: 'بازگشت ناشناس از درگاه',
  factor: 'پیامک فاکتور',
  notice: 'پیامک اطلاع‌رسانی ارسال',
  payment_link: 'پیامک لینک پرداخت',
  match: 'تطبیق شاهکار',
  create: 'ایجاد',
  update: 'ویرایش',
  delete: 'حذف',
  block: 'مسدودسازی',
  unblock: 'رفع مسدودی',
  password_reset: 'بازنشانی گذرواژه',
  wallet_adjust: 'تعدیل کیف پول',
  status_change: 'تغییر وضعیت',
  items_remove: 'حذف اقلام',
  pickup_cancel: 'لغو تحویل حضوری',
  pickup_reschedule: 'زمان‌بندی مجدد تحویل',
  role_change: 'تغییر دسترسی',
};
