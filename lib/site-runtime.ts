/**
 * کانتکست اجرایی سایت — تک‌نمونه روی globalThis.
 *
 * Next هر باندل سروری (layout/handler/proxy) ممکن است کپی جدا از ماژول‌ها
 * بسازد؛ اگر ALS در module-scope باشد، کانتکست در یک کپی می‌نشیند و Proxy
 * دیتابیس از کپی دیگر null می‌خواند (باگ «دیتای فروشگاه اول»). با
 * globalThis همه‌ی کپی‌ها همان یک ALS را می‌بینند.
 *
 * این فایل عمداً هیچ import از next/headers ندارد تا proxy (Node runtime)
 * هم بدون مشکل آن را باندل کند.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface SiteContext {
  domain: string | null;
  /** true وقتی دامنه از درخواست resolve شده (proxy یا ensureSiteContext). */
  __resolved?: boolean;
}

const globalForSite = globalThis as unknown as {
  __siteAls?: AsyncLocalStorage<SiteContext>;
};

/** تک‌نمونه‌ی ALS روی globalThis — مشترک بین همه‌ی باندل‌ها. */
if (!globalForSite.__siteAls) {
  globalForSite.__siteAls = new AsyncLocalStorage<SiteContext>();
}
export const siteAls: AsyncLocalStorage<SiteContext> = globalForSite.__siteAls;

/** خواندن sync دامنه‌ی فعلی — فقط lib/db.ts باید مصرفش کند. */
export function siteFromContext(): string | null {
  return siteAls.getStore()?.domain ?? null;
}

/**
 * نشاندن کانتکست به‌صورت sync — از proxy (که هدرها را sync دارد) و از
 * ensureSiteContext (سمت RSC/handler) استفاده می‌شود.
 */
export function enterSiteContext(domain: string | null): void {
  siteAls.enterWith({ domain });
}

/** نرمال‌سازی هر ورودی به شکل دامنه‌ی خام (بدون پروتکل/www/پورت/مسیر). */
export function normalizeDomain(raw: string | null | undefined): string {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/:?#]/)[0];
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0']);

/** آیا host جاری یک localhost است. */
export function isLocalHost(host: string | null | undefined): boolean {
  return LOCAL_HOSTS.has(normalizeDomain(host));
}

/** آیا سرور در حالت production اجرا می‌شود (`next start`/Docker). */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** هشدار یک‌باره برای پیکربندی اشتباه SHOP_DOMAIN در production. */
let warnedShopDomainInProd = false;

/**
 * قلب multi-tenancy — تک‌منبع resolve دامنه برای proxy، site-context و
 * core-license. قواعد (تصمیم کاربر):
 *  - توسعه: SHOP_DOMAIN اگر ست باشد بر می‌برد («به‌عنوان این سایت اجرا شو» —
 *    بی‌توجه به آدرس درخواست)؛ localhost بدون آن → null یعنی دیتابیس اصلی dev.
 *  - production: فقط آدرس درخواست معتبر است؛ SHOP_DOMAIN تنها وقتی پذیرفته
 *    می‌شود که خودِ درخواست localhost باشد (سرور تست/healthcheck) وگرنه نادیده
 *    گرفته و هشدار داده می‌شود. null در production یعنی fail-closed (هیچ‌وقت
 *    دیتابیس اصلی prod سرو نمی‌شود).
 *
 * ترتیب هدرها: `host` قبل از `x-forwarded-host` — پشت nginx مقدار Host توسط
 * `proxy_set_header Host $host` اجباری می‌شود و قابل فورج نیست؛ x-forwarded-host
 * فقط fallback است برای پراکسی‌هایی که Host را بازمی‌نویسند (هر دو کلاینتی‌اند
 * و صرفِ همین‌ها گیت لایسنس/دامنه را پاس نمی‌کنند).
 */
export function resolveSiteDomain(input: {
  forwardedHost?: string | null;
  host?: string | null;
  /** دامنه‌ی resolveشده‌ی پراکسی (هدر x-site-domain) — فقط برای مصرف داخل اپ. */
  proxiedSite?: string | null;
}): string | null {
  // هدر x-site-domain بعد از پراکسی معتبر است — پراکسی همیشه بازنویسی‌اش
  // می‌کند (دامنه‌ی resolveشده) یا حذفش (وقتی دامنه‌ای نیست)، پس مقدارش هرگز
  // انتخابِ دست کلاینت نیست.
  const proxied = normalizeDomain(input.proxiedSite ?? '');
  if (proxied && !isLocalHost(proxied)) {
    return proxied;
  }

  const requestHost = normalizeDomain((input.host ?? input.forwardedHost ?? '').split(',')[0]);

  const override = normalizeDomain(process.env.SHOP_DOMAIN);
  if (override && !isLocalHost(override)) {
    if (!isProductionRuntime() || isLocalHost(requestHost)) {
      return override;
    }
    if (!warnedShopDomainInProd) {
      warnedShopDomainInProd = true;
      console.warn(
        '[site-runtime] SHOP_DOMAIN در production برای درخواست‌های غیر-local نادیده گرفته می‌شود — دامنه از Host درخواست خوانده می‌شود.'
      );
    }
  }

  // هدر ممکن است فهرست باشد («a.ir, b.ir») — ورودی اول معتبر است.
  if (requestHost && !isLocalHost(requestHost)) {
    return requestHost;
  }
  return null;
}
