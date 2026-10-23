/**
 * System logs (لاگ‌های سیستمی): audit trail دو دسته:
 *  - خطاهای زیرساختی (شروع/تأیید درگاه، ارسال پیامک، شاهکار) با پاسخ واقعی
 *    API مقصد — همان‌طور که از اول بوده؛
 *  - رویدادهای مدیریتی (logSystemEvent): تغییر دسترسی/نقش‌ها/کاربران و
 *    تغییر سفارش‌ها — با «چه کسی» (actorName) و «چه زمانی».
 *
 * Recording must never throw: a logging failure inside an error path would
 * turn a bad payment into a crashed request.
 */

import prisma from './db';
import type { SystemLogDTO, SystemLogKind } from './system-log-defs';

export { ACTION_LABELS, KIND_COLORS, KIND_LABELS } from './system-log-defs';
export type { SystemLogDTO, SystemLogKind } from './system-log-defs';

const MAX_DETAIL = 2000;

/** Records one failure. Never throws — errors are swallowed (best effort). */
export async function logSystemError(entry: {
  kind: SystemLogKind;
  /** Gateway/panel id (zarinpal, sadad, mediana…). */
  provider: string;
  action: string;
  /** Persian one-liner for the table. */
  message: string;
  /** Raw API response/error text — the "why". */
  detail?: string;
}): Promise<void> {
  await writeSystemLog({ ...entry, actorName: '' });
}

/**
 * Records one admin/staff event — access and order changes. `actorName` is
 * the display name of the acting session (captured server-side from the
 * session, never from the client). Never throws.
 */
export async function logSystemEvent(entry: {
  kind: SystemLogKind;
  /** Short descriptor of the touched area: 'roles', 'users', 'orders'… */
  provider: string;
  action: string;
  /** Persian one-liner for the table. */
  message: string;
  /** نام نمایشی انجام‌دهنده (از نشست سمت سرور). */
  actorName: string;
  /** Optional extra context (order ids, before/after). */
  detail?: string;
}): Promise<void> {
  await writeSystemLog(entry);
}

/** The single Prisma write both helpers funnel into — swallows its own errors. */
async function writeSystemLog(entry: {
  kind: SystemLogKind;
  provider: string;
  action: string;
  message: string;
  actorName: string;
  detail?: string;
}): Promise<void> {
  try {
    await prisma.systemLog.create({
      data: {
        kind: entry.kind,
        provider: entry.provider,
        action: entry.action,
        message: entry.message.slice(0, 500),
        detail: (entry.detail ?? '').slice(0, MAX_DETAIL),
        actorName: (entry.actorName ?? '').slice(0, 120),
      },
    });
  } catch (error) {
    console.error('Failed to record system log:', error);
  }
}

/** Formats a Date as Jalali "yyyy/MM/dd HH:mm" with ASCII digits. */
function toJalali(date: Date): string {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const daysBeforeMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const div = (a: number, b: number): number => Math.floor(a / b);

  let jy = gy <= 1600 ? 0 : 979;
  const gy2 = gy <= 1600 ? gy - 621 : gy - 1600;
  const gy3 = gm > 2 ? gy2 + 1 : gy2;
  let days =
    365 * gy2 +
    div(gy3 + 3, 4) -
    div(gy3 + 99, 100) +
    div(gy3 + 399, 400) -
    80 +
    gd +
    daysBeforeMonth[gm - 1];

  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }

  const month = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const day = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  const pad2 = (value: number): string => String(value).padStart(2, '0');
  const pad4 = (value: number): string => String(value).padStart(4, '0');

  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());
  return `${pad4(jy)}/${pad2(month)}/${pad2(day)} ${hour}:${minute}`;
}

/** Newest logs first, optionally filtered by kind. */
export async function listSystemLogs(kind?: SystemLogKind): Promise<SystemLogDTO[]> {
  const rows = await prisma.systemLog.findMany({
    where: kind ? { kind } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  return rows.map((row) => ({
    id: row.id,
    kind: (['sms', 'shahkar', 'access', 'order'].includes(row.kind)
      ? row.kind
      : 'gateway') as SystemLogKind,
    provider: row.provider,
    action: row.action,
    message: row.message,
    detail: row.detail,
    actorName: row.actorName,
    createdAt: toJalali(row.createdAt),
  }));
}

/** Clears the log — the admin page's reset button. */
export async function clearSystemLogs(kind?: SystemLogKind): Promise<void> {
  await prisma.systemLog.deleteMany({ where: kind ? { kind } : undefined });
}
