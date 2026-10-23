/**
 * Shared, dependency-free definitions for the system-log feature — safe to
 * import from client components (unlike lib/system-logs.ts, which owns the
 * Prisma-backed recording and lives server-side only).
 *
 * Two families share the table:
 *  - **failure rows** (`gateway` | `sms` | `shahkar`) — a third-party API said
 *    no, and `detail` holds the raw answer;
 *  - **audit rows** (`user` | `price` | `order`) — a staff member changed
 *    something, and `detail` holds the before/after of the changed fields.
 */

/** The failure kinds. */
export type SystemLogFailureKind = 'gateway' | 'sms' | 'shahkar';

/** The audit kinds — «کاربران»، «قیمت‌ها»، «سفارش‌ها». */
export type SystemLogAuditKind = 'user' | 'price' | 'order';

export type SystemLogKind = SystemLogFailureKind | SystemLogAuditKind;

/** Every kind, in the order the filter lists them (failures first, as before). */
export const FAILURE_KINDS: SystemLogFailureKind[] = ['gateway', 'sms', 'shahkar'];
export const AUDIT_KINDS: SystemLogAuditKind[] = ['user', 'price', 'order'];
export const SYSTEM_LOG_KINDS: SystemLogKind[] = [...FAILURE_KINDS, ...AUDIT_KINDS];

/**
 * True for the audit family. Failure rows expand to a raw API response dumped
 * in an LTR code block; audit rows expand to Persian text read right-to-left,
 * so the viewer has to know which is which.
 */
export function isAuditKind(kind: SystemLogKind): kind is SystemLogAuditKind {
  return (AUDIT_KINDS as readonly string[]).includes(kind);
}

export interface SystemLogDTO {
  id: string;
  kind: SystemLogKind;
  provider: string;
  action: string;
  message: string;
  detail: string;
  /** Staff member behind an audit row; '' on failure rows. */
  actor: string;
  /** Pre-formatted Jalali date+time "yyyy/MM/dd HH:mm" (ASCII digits). */
  createdAt: string;
}

/** Persian labels for the log actions. */
export const ACTION_LABELS: Record<string, string> = {
  // Failure verbs.
  start: 'شروع پرداخت',
  verify: 'تأیید تراکنش',
  factor: 'پیامک فاکتور',
  notice: 'پیامک اطلاع‌رسانی ارسال',
  payment_link: 'پیامک لینک پرداخت',
  match: 'تطبیق شاهکار',
  // Audit verbs.
  create: 'ایجاد',
  update: 'ویرایش',
  delete: 'حذف',
  permissions: 'تغییر دسترسی',
  role: 'تغییر نقش',
  price: 'تغییر قیمت',
  status: 'تغییر وضعیت',
  block: 'تغییر وضعیت حساب',
};

/** Persian label per kind — the type badge in the table and the filter. */
export const KIND_LABELS: Record<SystemLogKind, string> = {
  gateway: 'درگاه پرداخت',
  sms: 'پنل پیامکی',
  shahkar: 'شاهکار',
  user: 'کاربران',
  price: 'قیمت‌ها',
  order: 'سفارش‌ها',
};

/** Mantine colour key per kind — audit kinds deliberately read as "not an error". */
export const KIND_COLORS: Record<SystemLogKind, string> = {
  gateway: 'indigo',
  sms: 'grape',
  shahkar: 'teal',
  user: 'blue',
  price: 'orange',
  order: 'cyan',
};
