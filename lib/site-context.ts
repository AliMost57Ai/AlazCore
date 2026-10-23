/**
 * کانتکست سایت درخواست — قلب multi-tenancy داینامیک (سمت سروری با headers).
 *
 * قواعد انتخاب دامنه در resolveSiteDomain (lib/site-runtime.ts) متمرکز است:
 *  - توسعه: SHOP_DOMAIN اگر ست باشد برمی‌برد («به‌عنوان این سایت اجرا شو»).
 *  - production: فقط آدرس درخواست (x-forwarded-host/host) — هدر x-site-domain
 *    کلاینتی فورج‌پذیر است و عمداً در زنجیره‌ی resolve عمومی خوانده نمی‌شود؛
 *    فقط مسیرهای app/api/core/* بعد از احراز x-core-key آن را صریح می‌خوانند.
 *  - localhost/127.0.0.1 بدون SHOP_DOMAIN → null؛ در dev یعنی دیتابیس اصلی و
 *    bypass اعتبارسنجی (حالت تست راحت)، در production یعنی fail-closed.
 *
 * ALS تک‌نمونه در lib/site-runtime.ts زندگی می‌کند (globalThis) تا همه‌ی
 * باندل‌های Next همان کانتکست را ببینند.
 */

import { headers } from 'next/headers';
import {
  enterSiteContext,
  isProductionRuntime,
  normalizeDomain,
  resolveSiteDomain,
  siteAls,
} from './site-runtime';

export {
  enterSiteContext,
  isLocalHost,
  isProductionRuntime,
  normalizeDomain,
  resolveSiteDomain,
  siteFromContext,
} from './site-runtime';

/**
 * دامنه‌ی درخواست جاری از هدرها — برای مصرف در RSC/server-action که کانتکست
 * ALS از پراکسی نرسیده (layoutها، صفحات وضعیت). خارج از scope درخواست null.
 * هدر x-site-domain فقط وقتی معتبر است که پراکسی آن را بازنویسی کرده باشد
 * (resolveSiteDomain توضیحش را دارد).
 */
export async function currentRequestDomain(): Promise<string | null> {
  try {
    const headerList = await headers();
    return resolveSiteDomain({
      proxiedSite: headerList.get('x-site-domain'),
      forwardedHost: headerList.get('x-forwarded-host'),
      host: headerList.get('host'),
    });
  } catch {
    return null;
  }
}

/**
 * دامنه‌ی فعال این درخواست را resolve و روی زنجیره‌ی async همان درخواست
 * می‌نشاند؛ دیتابیس سایت را هم پیش‌گرم می‌کند. یک بار در ابتدای هر درخواست؛
 * فراخوانی‌های بعدی ارزان‌اند.
 */
export async function ensureSiteContext(): Promise<string | null> {
  // فاز build پرایسما به دیتابیس اصلی وصل است — کانتکست سایت معنا ندارد.
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return null;
  }
  const existing = siteAls.getStore();
  if (existing && existing.__resolved) {
    return existing.domain;
  }

  let domain: string | null;
  try {
    const headerList = await headers();
    domain = resolveSiteDomain({
      proxiedSite: headerList.get('x-site-domain'),
      forwardedHost: headerList.get('x-forwarded-host'),
      host: headerList.get('host'),
    });
  } catch {
    // خارج از scope درخواست (seed/اسکریپت) → دیتابیس اصلی.
    domain = null;
  }

  // پیش‌گرم کلاینت/دیتابیس سایت قبل از اولین کوئری — تا Proxy دیتابیس
  // به‌صورت sync آماده باشد. ساخت on-demand فقط توسعه؛ production نبودِ
  // فایل را در lib/db.ts با SiteUnavailableError fail-closed می‌کند.
  if (domain) {
    const { ensureSiteDb } = await import('./site-db');
    await ensureSiteDb(domain, { allowCreate: !isProductionRuntime() });
  }

  enterSiteContext(domain);
  return domain;
}

/**
 * الگوی درستِ نشاندن کانتکست در routeهای فایل‌محور (آپلود/سرو):
 *
 *   enterSiteContext(await currentRequestDomain());
 *
 * enterWith باید «در فریم خودِ handler» اجرا شود — داخل هر هلپر async (حتی
 * همین ماژول) به زنجیره‌ی caller نمی‌رسد (تلهٔ ALS؛ discovered 2026-10-18:
 * فایل‌های آپلودی با این هلپر هم باز به data/ اصلی می‌رفتند). بعد از این
 * خط، siteFromContext() sync در همان route دامنه را می‌بیند.
 */

/**
 * resolve دامنه برای فراخوانی‌های احرازشده‌ی پنل Core (app/api/core/*) —
 * دامنه صریح از هدر x-site-domain. این هدر کلاینتی و فورج‌پذیر است و فقط
 * بعد از احراز x-core-key معتبر است؛ به همین دلیل عمداً در زنجیره‌ی resolve
 * عمومی (resolveSiteDomain) خوانده نمی‌شود.
 *
 * عمداً enterSiteContext را اینجا صدا نمی‌زند: enterWith داخل یک هلپرِ
 * await‌شده به ادامه‌ی handler برنمی‌گردد (AsyncLocalStorage زنجیره‌ی والد را
 * عوض نمی‌کند) — route خودش بعد از await، در فریم خودش enterSiteContext بزند.
 * خروجی null = دامنه نفرستاده یا دیتابیسش (هنوز) provision نشده.
 */
export async function ensureCoreSiteDb(request: {
  headers: { get: (name: string) => string | null };
}): Promise<string | null> {
  const domain = normalizeDomain(request.headers.get('x-site-domain'));
  if (!domain) {
    return null;
  }
  const { ensureSiteDb } = await import('./site-db');
  const client = await ensureSiteDb(domain, { allowCreate: !isProductionRuntime() });
  return client ? domain : null;
}
