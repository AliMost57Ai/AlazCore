/**
 * System logs (لاگ‌های سیستمی): a small audit trail with two jobs.
 *
 *  - **Failures** — every failed gateway start/verify and every failed SMS
 *    dispatch is recorded with the error the target API actually returned, so
 *    the admin page shows what went wrong instead of a generic message.
 *  - **Audit** — every staff-side change worth answering for later: role
 *    permissions and titles, account creation/edits/blocks, batch price
 *    updates and order status moves. Each row names the staff member behind it.
 *
 * Recording must never throw: a logging failure inside an error path would
 * turn a bad payment into a crashed request, and a logging failure inside a
 * successful mutation would turn a saved change into a 500.
 */

import prisma from './db';
import {
  SYSTEM_LOG_KINDS,
  type SystemLogAuditKind,
  type SystemLogDTO,
  type SystemLogFailureKind,
  type SystemLogKind,
} from './system-log-defs';

export { ACTION_LABELS } from './system-log-defs';
export type { SystemLogDTO, SystemLogKind } from './system-log-defs';

const MAX_DETAIL = 2000;

/** The single insert path. Never throws — errors are swallowed (best effort). */
async function write(entry: {
  kind: SystemLogKind;
  provider: string;
  action: string;
  message: string;
  detail: string;
  actor: string;
}): Promise<void> {
  try {
    await prisma.systemLog.create({
      data: {
        kind: entry.kind,
        provider: entry.provider.slice(0, 100),
        action: entry.action,
        message: entry.message.slice(0, 500),
        detail: entry.detail.slice(0, MAX_DETAIL),
        actor: entry.actor.slice(0, 100),
      },
    });
  } catch (error) {
    console.error('Failed to record system log:', error);
  }
}

/** Records one failure. Never throws. */
export async function logSystemError(entry: {
  kind: SystemLogFailureKind;
  /** Gateway/panel id (zarinpal, sadad, mediana…). */
  provider: string;
  action: string;
  /** Persian one-liner for the table. */
  message: string;
  /** Raw API response/error text — the "why". */
  detail?: string;
}): Promise<void> {
  await write({
    kind: entry.kind,
    provider: entry.provider,
    action: entry.action,
    message: entry.message,
    detail: entry.detail ?? '',
    actor: '',
  });
}

/**
 * Records one staff-side change. Never throws.
 *
 * `actor` is the display name, not the id: the log is read by a human a week
 * later, and an id would mean a second lookup to answer "who did this?".
 * Renaming a user therefore renames their older log rows too — acceptable,
 * because these rows exist to explain a change, not to survive an audit trail
 * with legal weight (PriceChange keeps the same convention).
 */
export async function logSystemAudit(entry: {
  kind: SystemLogAuditKind;
  /** 'create' | 'update' | 'delete' | 'permissions' | … — see ACTION_LABELS. */
  action: string;
  /** Persian one-liner for the table. */
  message: string;
  /** Changed fields as Persian before/after lines (one per line). */
  detail?: string;
  actor: string;
}): Promise<void> {
  await write({
    kind: entry.kind,
    provider: '',
    action: entry.action,
    message: entry.message,
    detail: entry.detail ?? '',
    actor: entry.actor,
  });
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

/**
 * Narrows the free-form `kind` column back to the union. A row written by an
 * older build (or by hand) falls back to 'gateway' rather than crashing the
 * page — the viewer only ever needs a label, not a guarantee.
 */
function toKind(raw: string): SystemLogKind {
  return (SYSTEM_LOG_KINDS as readonly string[]).includes(raw) ? (raw as SystemLogKind) : 'gateway';
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
    kind: toKind(row.kind),
    provider: row.provider,
    action: row.action,
    message: row.message,
    detail: row.detail,
    actor: row.actor,
    createdAt: toJalali(row.createdAt),
  }));
}

/** Clears the log — the admin page's reset button. */
export async function clearSystemLogs(kind?: SystemLogKind): Promise<void> {
  await prisma.systemLog.deleteMany({ where: kind ? { kind } : undefined });
}
