/**
 * موتور لایسنس — payload ای که فروشگاه‌ها با POST /api/validate می‌گیرند.
 *
 * یک دامین فقط وقتی «مجاز» است که:
 *  - ردیفش isActive باشد و status == 'active'،
 *  - پلن تخصیص‌یافته فعال و در بازه اعتبار باشد،
 *  - اعتبار دامین/پلن تمام نشده باشد.
 * خروجی شامل تم فعال (یا پیش‌فرض)، منوهای مجاز پنل ادمینِ سایت، و درگاه‌ها و
 * پنل‌های پیامکی فعالِ همان دامین است — دقیقاً همان چیزی که فروشگاه برای لود
 * شدن و نمایش منوها/درگاه‌ها لازم دارد.
 */

import prisma from './db';

export interface LicenseSnapshot {
  ok: boolean;
  domain: string;
  /** 'active' | 'inactive' | 'suspended' | 'expired' | 'unknown' */
  status: 'active' | 'inactive' | 'suspended' | 'expired' | 'unknown';
  reason?: string;
  owner?: { name: string; phone: string; email: string };
  plan?: {
    id: string;
    name: string;
    menus: string[];
    limits: Record<string, unknown>;
    expiresAt: string | null;
    /** شروع اعتبار پلن (آخرین تخصیص) — progress bar داشبورد مالک. */
    startsAt?: string | null;
  };
  /** درصد پورسانت آلازکور از فروش این سایت — گزارش درآمد سمت فروشگاه. */
  commissionPercent?: number;
  /** وضعیت دیتابیس اختصاصی سایت — pending یعنی provision هنوز کامل نشده. */
  dbStatus?: 'ready' | 'pending';
  /** خالی‌فروشی — سقف مجاز کل فروشگاه؛ مجاز نبودن = allowed false. */
  oversell?: { allowed: boolean; max: number };
  /** تحویل حضوری — خاموش = منوها/صفحات مرتبط در فروشگاه پنهان. */
  inPersonDelivery?: boolean;
  theme?: { id: string; key: string; name: string } | null;
  gateways?: { id: string; kind: string; label: string }[];
  sms?: { id: string; label: string }[];
}

/** کلید API معتبر — از CoreSetting یا ENV. */
export async function resolveApiKey(): Promise<string | null> {
  if (process.env.CORE_API_KEY) {
    return process.env.CORE_API_KEY;
  }
  const row = await prisma.coreSetting.findUnique({ where: { key: 'api_key' } });
  return row?.value ?? null;
}

export async function buildLicenseSnapshot(rawDomain: string): Promise<LicenseSnapshot> {
  // نرمال‌سازی: بدون پروتکل/www/مسیر/پورت — کوکی/هدر ممکن است هر شکلی بیاورند.
  const domain = rawDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/:?#]/)[0];

  const row = await prisma.domain.findUnique({
    where: { domain },
    include: {
      plan: true,
      template: true,
      gateways: { where: { isActive: true } },
      smsPanels: { where: { isActive: true } },
    },
  });

  if (!row) {
    return { ok: false, domain, status: 'unknown', reason: 'دامنه در سامانه Core ثبت نشده است.' };
  }

  const base = {
    domain,
    owner: { name: row.ownerName, phone: row.ownerPhone, email: row.ownerEmail },
  };

  if (!row.isActive) {
    return { ok: false, ...base, status: 'inactive', reason: 'دامنه غیرفعال است.' };
  }
  if (row.status === 'suspended') {
    return {
      ok: false,
      ...base,
      status: 'suspended',
      reason: 'دامنه توسط پشتیبانی تعلیق شده است.',
    };
  }

  // اعتبار پلن: تاریخ انقضا (پلن یا دامین) گذشته باشد = expired.
  const expiresAt = row.planExpiresAt;
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    return { ok: false, ...base, status: 'expired', reason: 'اعتبار پلن به پایان رسیده است.' };
  }
  if (row.plan && !row.plan.isActive) {
    return { ok: false, ...base, status: 'inactive', reason: 'پلن تخصیص‌یافته غیرفعال است.' };
  }

  // تم: تم فعال تخصیص‌یافته؛ اگر آن تم غیرفعال شده، تم پیش‌فرض.
  let theme: LicenseSnapshot['theme'] = null;
  if (row.template && row.template.isActive) {
    theme = { id: row.template.id, key: row.template.key, name: row.template.name };
  } else {
    const fallback = await prisma.template.findFirst({
      where: { isDefault: true, isActive: true },
    });
    theme = fallback ? { id: fallback.id, key: fallback.key, name: fallback.name } : null;
  }

  // شروع اعتبار نوار داشبورد مالک: تاریخ آخرین تمدید، و در نبودش تاریخ
  // ثبت دامنه — ردیف‌های تخصیص/تغییر پلن مبنای شمارش نیستند.
  const validityStart = row.lastRenewalAt ?? row.createdAt;

  return {
    ok: true,
    ...base,
    status: 'active',
    commissionPercent: row.commissionPercent,
    dbStatus: (row.dbStatus as 'ready' | 'pending' | null) ?? 'pending',
    oversell: { allowed: row.oversellAllowed, max: row.oversellMax },
    inPersonDelivery: row.inPersonDelivery,
    plan: row.plan
      ? {
          id: row.plan.id,
          name: row.plan.name,
          menus: safeJsonArray(row.plan.menus),
          limits: safeJsonObject(row.plan.limits),
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          startsAt: validityStart.toISOString(),
        }
      : undefined,
    theme,
    gateways: row.gateways.map((g) => ({
      id: g.gateway,
      kind: g.kind,
      label: g.label || g.gateway,
    })),
    sms: row.smsPanels.map((s) => ({ id: s.provider, label: s.label || s.provider })),
  };
}

function safeJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function safeJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
