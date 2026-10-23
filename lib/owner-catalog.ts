/**
 * کاتالوگ مجازِ داشبورد مالک — ترکیب دو منبع (به پیشنهاد کاربر):
 *  ۱. تخصیص‌های پنل Core (از payload لایسنس)؛
 *  ۲. درگاه/پنل‌هایی که مالک قبلاً در دیتابیس **خودش** کانفیگ کرده — این‌ها
 *     همیشه می‌مانند و با تغییر تخصیص حذف نمی‌شوند (هم‌راستا با قاعده
 *     «در حال استفاده»).
 *
 * اگر Core تنظیم نشده/در دسترس نیست → null یعنی بدون محدودیت (رفتار قبلی).
 * API عمومی‌اش: GET /api/admin/settings/assigned
 */

import { getLicensedCatalog, type LicensedCatalog } from './core-license';
import prisma from './db';
import { GATEWAYS } from './gateways/registry';

/** پنل‌های پیامکی شناخته‌شده — هم‌نام با lib/order-sms. */
const KNOWN_SMS = ['mediana', 'smsir', 'melipayamak', 'payamresan', 'farazsms'];

const KNOWN_IPG = GATEWAYS.filter((gateway) => gateway.kind === 'ipg').map((gateway) => gateway.id);
const KNOWN_BNPL = GATEWAYS.filter((gateway) => gateway.kind === 'bnpl').map(
  (gateway) => gateway.id
);

/** شناسه‌هایی که مالک برایشان تنظیمات غیرخالی در دیتابیس خودش دارد. */
async function locallyConfigured(candidates: string[]): Promise<string[]> {
  const rows = await prisma.appConfig.findMany({ select: { key: true, value: true } });
  const out: string[] = [];
  for (const id of candidates) {
    const used = rows.some(
      (row) => row.key.toLowerCase().startsWith(id.toLowerCase()) && row.value.trim() !== ''
    );
    if (used) {
      out.push(id);
    }
  }
  return out;
}

function merge(assigned: string[] | null, local: string[]): string[] | null {
  if (assigned === null) {
    return null; // Core غایب — بدون محدودیت
  }
  return [...new Set([...assigned, ...local])];
}

export interface OwnerCatalog extends LicensedCatalog {
  /** منبع محدودیت — برای شفافیت در API. */
  sources: { assigned: boolean; localConfigured: boolean };
}

export async function getOwnerAllowedCatalog(): Promise<OwnerCatalog | null> {
  const licensed = await getLicensedCatalog();
  const assigned = licensed.ipg !== null || licensed.sms !== null || licensed.themes !== null;

  const [ipgLocal, bnplLocal, smsLocal] = await Promise.all([
    locallyConfigured(KNOWN_IPG),
    locallyConfigured(KNOWN_BNPL),
    locallyConfigured(KNOWN_SMS),
  ]);
  const anyLocal = ipgLocal.length > 0 || bnplLocal.length > 0 || smsLocal.length > 0;

  if (!assigned) {
    // Core تنظیم نشده/پاسخ نداد — ولی اگر مالک قبلاً چیزی کانفیگ کرده باشد
    // فقط همان‌ها را نشان بده (خواسته: لیست از منابع معتبر)، وگرنه همه‌چیز.
    if (anyLocal) {
      return {
        themes: null,
        ipg: ipgLocal,
        bnpl: bnplLocal,
        sms: smsLocal,
        sources: { assigned: false, localConfigured: true },
      };
    }
    return null;
  }

  return {
    themes: licensed.themes,
    ipg: merge(licensed.ipg, ipgLocal),
    bnpl: merge(licensed.bnpl, bnplLocal),
    sms: merge(licensed.sms, smsLocal),
    sources: { assigned: true, localConfigured: anyLocal },
  };
}
