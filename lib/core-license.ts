/**
 * کلاینت لایسنس فروشگاه — پل ارتباطی با پنل Core (سوپرادمین).
 *
 * طبق سناریوی سامانه: هر فروشگاه قبل از لود شدن، اعتبارش را با سرویس Core
 * چک می‌کند (POST /api/validate با هدر x-core-key). پاسخ تعیین می‌کند:
 *  - سایت اصلاً لود شود یا نه (ok/status)،
 *  - پلن چه منوهایی به ادمین سایت می‌دهد (plan.menus)،
 *  - کدام درگاه‌ها/درگاه اقساطی/پنل پیامکی برایش فعال است.
 *
 * رفتار خطا (قابل تنظیم با CORE_FAIL_MODE):
 *  - Core تنظیم نشده: در توسعه بدون کور فروشگاه مستقل کار می‌کند (بایپس)؛
 *    در production مثل «کور در دسترس نیست» رفتار می‌شود — closed (پیش‌فرض)
 *    هیچ صفحه‌ای بدون تأیید کور لود نمی‌شود (قرارداد محصول: اعتبارسنجی دامنه
 *    حتماً از سمت کور)، open فقط لاگ می‌کند و باز می‌ماند.
 *  - Core در دسترس نیست → 'closed' (پیش‌فرض): تا تأیید Core هیچ صفحه‌ای لود
 *    نمی‌شود و «سرویس موقتاً در دسترس نیست» دیده می‌شود؛ 'open' فقط لاگ
 *    می‌کند و سایت باز می‌ماند.
 *
 * کش در حافظه‌ی ماژول: لایسنس تأییدشده به‌صورت پیش‌فرض ۱۵ دقیقه (تصمیم کاربر؛
 * با LICENSE_CACHE_TTL_SEC قابل تنظیم است) — هر دامنه حداکثر هر ۱۵ دقیقه یک
 * بار Core را می‌پرسد؛ پیامد: تعلیق/انقضای دامنه حداکثر ۱۵ دقیقه بعد اعمال
 * می‌شود. پاسخ ناموفق (Core قطع/کلید رد) ۱۵ ثانیه کش منفی می‌شود تا هر لود
 * صفحه ۴ ثانیه معطل تایم‌اوت نماند.
 */

import { hasCapability } from './nav-permissions';
import { effectivePermissions, type SessionPayload } from './session';
import { isProductionRuntime } from './site-runtime';

export interface CoreLicense {
  ok: boolean;
  domain: string;
  status: 'active' | 'inactive' | 'suspended' | 'expired' | 'unknown';
  reason?: string;
  owner?: { name: string; phone: string; email: string };
  plan?: {
    id: string;
    name: string;
    menus: string[];
    limits: Record<string, unknown>;
    expiresAt: string | null;
    /** شروع اعتبار پلن از آخرین تخصیص Core — مبنای progress bar داشبورد. */
    startsAt?: string | null;
  };
  /** درصد پورسانت آلازکور از فروش این سایت — گزارش درآمد مالک. */
  commissionPercent?: number;
  /** وضعیت دیتابیس اختصاصی سایت از کور — pending یعنی provision کامل نشده. */
  dbStatus?: 'ready' | 'pending';
  /** خالی‌فروشی — تنظیم پنل Core برای این دامنه. */
  oversell?: { allowed: boolean; max: number };
  /** تحویل حضوری — خاموش = منوها/صفحات مرتبط در فروشگاه پنهان. */
  inPersonDelivery?: boolean;
  /** فقط در پاسخ سنتزی failModeValue — «Core سالم پاسخ نداد»، نه «دامنه ثبت‌نشده». */
  serviceDown?: boolean;
  theme?: { id: string; key: string; name: string } | null;
  gateways?: { id: string; kind: string; label: string }[];
  sms?: { id: string; label: string }[];
}

// کش مثبت ۱۵ دقیقه‌ای (تصمیم کاربر) — با LICENSE_CACHE_TTL_SEC قابل تنظیم؛
// پیامد: تعلیق/انقضای دامنه حداکثر همین بازه بعد در فروشگاه اعمال می‌شود.
const CACHE_TTL_MS = Math.max(15, Number(process.env.LICENSE_CACHE_TTL_SEC) || 900) * 1000;
/** کش منفی پاسخ ناموفق — Core قطع، فشار تایم‌اوت ۴ ثانیه‌ای روی هر لود نمی‌آید. */
const NEG_CACHE_TTL_MS = 15 * 1000;

interface CacheEntry {
  at: number;
  value: CoreLicense | null;
  /** پاسخ ناموفق (Core قطع/کلید رد) — با TTL کوتاه‌تر منفی کش می‌شود. */
  neg?: boolean;
}

const globalForLicense = globalThis as unknown as {
  coreLicenseCache?: Map<string, CacheEntry>;
};

globalForLicense.coreLicenseCache ??= new Map();
const cache = globalForLicense.coreLicenseCache;

export function coreConfigured(): boolean {
  return Boolean(process.env.CORE_API_URL && process.env.CORE_API_KEY);
}

/** پاسخ کش‌شده‌ی لایسنس؛ null یعنی «نمی‌دانم» (Core تنظیم نشده/در دسترس نیست). */
export async function getLicense(
  domain: string,
  opts: { force?: boolean } = {}
): Promise<CoreLicense | null> {
  if (!domain) {
    return null;
  }
  if (!coreConfigured()) {
    // قرارداد fail-closed: در production نبودِ پیکربندی کور یعنی «نمی‌شود
    // تأیید کرد» — مثل قطعی کور با CORE_FAIL_MODE تصمیم می‌شود (closed =
    // مسدود). در توسعه بدون کور فروشگاه مستقل می‌ماند (رفتار قبلی).
    if (!isProductionRuntime()) {
      return null;
    }
    console.warn('[core-license] کور پیکربندی نشده — طبق CORE_FAIL_MODE رفتار می‌شود.');
    return failModeValue(domain);
  }

  const cached = cache.get(domain);
  if (!opts.force && cached) {
    const ttl = cached.neg ? NEG_CACHE_TTL_MS : CACHE_TTL_MS;
    if (Date.now() - cached.at < ttl) {
      return cached.value;
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(`${process.env.CORE_API_URL!.replace(/\/+$/, '')}/api/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-core-key': process.env.CORE_API_KEY!,
      },
      body: JSON.stringify({ domain }),
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    if (response.status === 401) {
      console.warn('[core-license] کلید API رد شد — اعتبارسنجی نتیجه‌ای ندارد.');
      return failModeValue(domain);
    }
    if (!response.ok) {
      return failModeValue(domain);
    }

    const license = (await response.json()) as CoreLicense;
    cache.set(domain, { at: Date.now(), value: license });
    return license;
  } catch (error) {
    console.warn('[core-license] سرویس Core پاسخ نداد:', (error as Error).message);
    return failModeValue(domain);
  }
}

function failModeValue(domain: string): CoreLicense | null {
  // پیش‌فرض 'closed' — قرارداد محصول: صفحه فقط بعد از تأیید Core لود می‌شود.
  // 'open' حالت اضطراری است و فقط لاگ می‌کند؛ هر دو ۱۵ ثانیه کش منفی می‌شوند.
  const value: CoreLicense | null =
    (process.env.CORE_FAIL_MODE ?? 'closed') === 'closed'
      ? {
          ok: false,
          domain,
          status: 'unknown',
          reason: 'سرویس اعتبارسنجی در دسترس نیست.',
          serviceDown: true,
        }
      : null;
  cache.set(domain, { at: Date.now(), value, neg: true });
  return value;
}

/** فقط دامنه‌های مسدودکننده — unknown بدون Core تنظیم‌شده اینجا نمی‌آید. */
export function isBlocking(license: CoreLicense | null): boolean {
  return license !== null && !license.ok;
}

/**
 * دامنه‌ی فعلی فروشگاه برای فراخوانی‌های سمت سرور (پیامک، تم، درگاه) که
 * درخواست/هدر ندارند — از resolveSiteDomain مرکزی (dev: SHOP_DOMAIN؛
 * production: Host). ناموفق = رشته خالی → کش نمی‌گیرد و بازه بی‌پاسخ
 * fail-open می‌ماند.
 */
export async function currentDomain(): Promise<string> {
  const { currentRequestDomain } = await import('./site-context');
  return (await currentRequestDomain()) ?? '';
}

/**
 * شناسه‌های درگاه مجاز پلن Core؛ null = بدون محدودیت (Core غایب یا پلن *).
 * با kind می‌شود فقط ipg یا فقط bnpl را خواست.
 */
export async function licensedGatewayIds(kind?: 'ipg' | 'bnpl'): Promise<Set<string> | null> {
  const domain = await currentDomain();
  const license = await getLicense(domain);
  if (!license?.ok || !license.plan) {
    return null;
  }
  const list = (license.gateways ?? []).filter((g) => !kind || g.kind === kind);
  // پلن هست ولی هیچ درگاهی فعال نشده = هیچ درگاهی مجاز نیست (مجموعه خالی).
  return new Set(list.map((g) => g.id));
}

/** شناسه‌های پنل پیامکی مجاز؛ null = بدون محدودیت. */
export async function licensedSmsIds(): Promise<Set<string> | null> {
  const domain = await currentDomain();
  const license = await getLicense(domain);
  if (!license?.ok || !license.plan) {
    return null;
  }
  return new Set((license.sms ?? []).map((s) => s.id));
}

/** کلید تم تعیین‌شده توسط Core برای این دامنه؛ null = تم داخلی فروشگاه. */
export async function licensedThemeKey(): Promise<string | null> {
  const domain = await currentDomain();
  const license = await getLicense(domain);
  if (!license?.ok) {
    return null;
  }
  return license.theme?.key ?? null;
}

/** سقف محصولات پلن Core؛ null = نامحدود یا Core غایب. */
export async function licensedProductLimit(): Promise<number | null> {
  const domain = await currentDomain();
  const license = await getLicense(domain);
  if (!license?.ok || !license.plan) {
    return null;
  }
  const raw = license.plan.limits.maxProducts;
  return typeof raw === 'number' && raw > 0 ? Math.floor(raw) : null;
}

/**
 * منوهای مجاز پلن Core؛ null یعنی «بدون محدودیت» (پلن * یا Core غایب).
 * تنظیمات درگاه/اقساط/پیامک فقط وقتی در مجموعه‌اند که پنل Core برای این
 * دامنه درگاه یا پنل پیامکیِ فعالی تعریف کرده باشد.
 */
export function coreAllowedHrefs(license: CoreLicense | null): Set<string> | null {
  if (!license?.ok || !license.plan) {
    return null;
  }
  const menus = license.plan.menus;
  if (menus.includes('*')) {
    return null;
  }
  const set = new Set(menus);
  // پشتیبانی Core حق مشترک همه دامنه‌های فعال است — مستقل از منوهای پلن.
  set.add('/support');
  const gateways = license.gateways ?? [];
  if (gateways.some((g) => g.kind === 'ipg')) {
    set.add('/settings/payment');
  }
  if (gateways.some((g) => g.kind === 'bnpl')) {
    set.add('/settings/bnpl');
  }
  if ((license.sms ?? []).length > 0) {
    set.add('/settings/sms');
    set.add('/settings/sms-templates');
  }
  return set;
}

/**
 * آیا خالی‌فروشی برای این فروشگاه فعال است؟ مبنای برچسب ویترین
 * («تنها ۱ عدد باقی مانده» به‌جای «ناموجود») و فعال ماندن سبد خرید.
 */
export async function isOversellEnabled(): Promise<boolean> {
  const license = await getLicense(await currentDomain());
  return license?.oversell?.allowed === true;
}

/**
 * آیا تحویل حضوری برای این فروشگاه فعال است؟ مبنای نمایش منوها/صفحات/روش
 * ارسال pickup — پنل Core آن را per-domain روشن/خاموش می‌کند. Core غایب
 * (dev بدون Core) یعنی فیچر در دسترس مالک است.
 */
export async function isInPersonDeliveryEnabled(): Promise<boolean> {
  const license = await getLicense(await currentDomain());
  if (license === null) {
    return true;
  }
  return license.inPersonDelivery === true;
}

/**
 * آیا این نشست می‌تواند خالی‌فروشی را روی کالاها تنظیم کند؟ زنجیره مجوز:
 * پنل Core برای این دامنه خالی‌فروشی را مجاز کرده باشد (لایسنس) و کاربر
 * ادمین باشد یا نقشش قابلیت 'cap:product-oversell' را داشته باشد.
 */
export async function canManageOversell(session: SessionPayload): Promise<boolean> {
  const license = await getLicense(await currentDomain());
  if (license?.oversell?.allowed !== true) {
    return false;
  }
  return hasCapability(effectivePermissions(session), 'cap:product-oversell');
}

/**
 * کاتالوگ مجاز داشبورد فروشگاه — فقط تم/درگاه/اقساط/پیامکی که پنل Core برای
 * این دامنه فعال کرده؛ null یعنی Core غایب است و همه‌چیز مثل قبل مجاز.
 */
export interface LicensedCatalog {
  themes: string[] | null;
  ipg: string[] | null;
  bnpl: string[] | null;
  sms: string[] | null;
}

export async function getLicensedCatalog(): Promise<LicensedCatalog> {
  const domain = await currentDomain();
  const license = await getLicense(domain);
  // فقط ok بودن لایسنس کافی است — درگاه/پیامک/تم مستقل از پلن تخصیص می‌شوند
  // (سایت بدون پلن هم فقط موارد تخصیص‌یافته را می‌بیند).
  if (!license?.ok) {
    return { themes: null, ipg: null, bnpl: null, sms: null };
  }
  const gateways = license.gateways ?? [];
  return {
    themes: license.theme?.key ? [license.theme.key] : null,
    ipg: gateways.filter((g) => g.kind === 'ipg').map((g) => g.id),
    bnpl: gateways.filter((g) => g.kind === 'bnpl').map((g) => g.id),
    sms: (license.sms ?? []).map((s) => s.id),
  };
}
