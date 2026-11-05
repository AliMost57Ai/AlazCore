/**
 * GET /api/core/diagnostics — «چرا فروشگاهِ این دامنه مسدود شده؟» از داخل خودِ
 * سرور (فروشگاه)، برای عیب‌یابی استقرار production.
 *
 * چرا این مسیر لازم شد: صفحه‌ی /site-inactive فقط می‌تواند بگوید «چه چیزی»
 * مسدود شده؛ برای «چرا» باید دامنه‌ی resolveشده، پاسخ واقعی Core و وجود فایل
 * دیتابیس همان دامنه را با هم دید. این مسیر همان سه چیز را برای یک دامنه
 * برمی‌گرداند و verdict نهایی می‌دهد.
 *
 * قراردادها:
 *  - احراز با هدر x-core-key (همان کلید مشترک Core) — داده‌ی محیطی برنمی‌گرداند
 *    مگر برای دارنده‌ی کلید؛ کلید در پاسخ ماسک می‌شود.
 *  - دامنه از `?domain=` یا از هدر Host/Host-forwarded همان درخواست خوانده
 *    می‌شود؛ هیچ کانتکست سایتی روی ALS نمی‌نشیند و هیچ دیتابیسی باز نمی‌شود —
 *    این مسیر فقط «می‌بیند»، پس روی هیچ فروشگاهی اثر نمی‌گذارد.
 *  - مسیر زیر /api/core است و از matcher پراکسی بیرون می‌ماند: حتی وقتی سایت
 *    مسدود است هم پاسخ می‌دهد (وگرنه برای عیب‌یابی به آن دسترسی نداشتیم).
 *
 * نمونه:
 *   curl -s -H "x-core-key: $KEY" "http://127.0.0.1:3000/api/core/diagnostics?domain=shop140.ir"
 */

import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { isProductionRuntime, normalizeDomain, resolveSiteDomain } from '@/lib/site-runtime';

export const dynamic = 'force-dynamic';

/**
 * هم‌سان با lib/site-db.ts و core/lib/provision.ts — عمداً اینجا تکرار شده تا
 * این مسیر هیچ ماژول Prisma/دیتابیسی را import نکند: عیب‌یابی باید حتی وقتی
 * دیتابیس سایت مشکل دارد (یا اصلاً نیست) هم پاسخ بدهد و به هیچ فروشگاهی دست
 * نزند. تغییر قاعده‌ی نام‌گذاری = تغییر هم‌زمان در هر سه جا.
 */
function sanitizeSiteDir(domain: string): string {
  return (
    domain
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 64) || 'site'
  );
}

function siteDbRelativePath(domain: string): string {
  const dir = sanitizeSiteDir(domain);
  return `data/sites/${dir}/${dir}.db`;
}

/** همان تعریف lib/core-license.ts (با trim) — بدون import آن ماژول. */
function coreConfigured(): boolean {
  return Boolean(coreApiUrl() && coreApiKey());
}

/** env-fileهای CRLF (ساخته‌شده روی ویندوز) مقدار را با `\r` آلوده می‌کنند. */
function coreApiUrl(): string {
  return (process.env.CORE_API_URL ?? '')
    .trim()
    .replace(/\/+$/, '');
}

function coreApiKey(): string {
  return (process.env.CORE_API_KEY ?? '').trim();
}

function coreFailMode(): 'open' | 'closed' {
  return (process.env.CORE_FAIL_MODE ?? 'closed').trim() === 'open' ? 'open' : 'closed';
}

/** مقایسه ثابت-زمانه کلید مشترک (همان الگوی app/api/core/site-admin). */
function keyEquals(provided: string, expected: string): boolean {
  const bufA = Buffer.from(provided);
  const bufB = Buffer.from(expected);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function maskKey(key: string | undefined): string {
  if (!key) {
    return '(خالی)';
  }
  if (key.length <= 8) {
    return `*** (len ${key.length})`;
  }
  return `${key.slice(0, 4)}…${key.slice(-4)} (len ${key.length})`;
}

interface CoreProbe {
  configured: boolean;
  url: string;
  reachable: boolean;
  httpStatus?: number;
  elapsedMs: number;
  ok?: boolean;
  status?: string;
  reason?: string;
  error?: string;
}

/**
 * یک استعلام واقعی (بدون کش) از /api/validate — عمداً کش لایسنس را دور
 * می‌زند: هدف دیدن «پاسخ همین لحظه» است، نه پاسخ ۱۵ دقیقه‌ی قبل.
 */
async function probeCore(domain: string): Promise<CoreProbe> {
  const url = coreApiUrl();
  const base: CoreProbe = { configured: coreConfigured(), url, reachable: false, elapsedMs: 0 };
  if (!base.configured) {
    return { ...base, error: 'CORE_API_URL یا CORE_API_KEY تنظیم نشده است.' };
  }

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${url}/api/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-core-key': coreApiKey(),
      },
      body: JSON.stringify({ domain }),
      signal: controller.signal,
      cache: 'no-store',
    });
    const elapsedMs = Date.now() - started;
    if (response.status === 401) {
      return {
        ...base,
        reachable: true,
        httpStatus: 401,
        elapsedMs,
        error: 'کلید API رد شد (401) — CORE_API_KEY فروشگاه با Core یکی نیست.',
      };
    }
    if (!response.ok) {
      return {
        ...base,
        reachable: true,
        httpStatus: response.status,
        elapsedMs,
        error: `پاسخ غیرموفق ${response.status} از Core.`,
      };
    }
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      status?: string;
      reason?: string;
    } | null;
    if (!body) {
      return {
        ...base,
        reachable: true,
        httpStatus: response.status,
        elapsedMs,
        error: 'پاسخ Core JSON معتبر نبود (CORE_API_URL درست است؟).',
      };
    }
    return {
      ...base,
      reachable: true,
      httpStatus: response.status,
      elapsedMs,
      ok: body.ok === true,
      status: body.status,
      reason: body.reason,
    };
  } catch (error) {
    const elapsedMs = Date.now() - started;
    const cause = error as Error;
    return {
      ...base,
      elapsedMs,
      error:
        cause.name === 'AbortError'
          ? 'پاسخ Core در ۴ ثانیه نرسید (timeout).'
          : `اتصال به Core برقرار نشد: ${cause.message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** راهنمای کوتاه هر verdict — دقیقاً همان کاری که ادمین باید بکند. */
const VERDICT_HINTS: Record<string, string> = {
  'domain-not-resolved':
    'پراکسی باید هدر Host را به اپ برساند (nginx: proxy_set_header Host $host). برای تست محلی روی localhost، SHOP_DOMAIN را ست کنید.',
  'core-not-configured':
    'CORE_API_URL/CORE_API_KEY را در env فروشگاه بگذارید؛ با CORE_FAIL_MODE=closed نبودِ Core سایت را مسدود می‌کند.',
  'open-core-not-configured':
    'Core تنظیم نیست ولی CORE_FAIL_MODE=open است — لایسنس سایت باز می‌ماند (فقط برای توسعه).',
  'core-unreachable-closed':
    'از داخل کانتینر فروشگاه به CORE_API_URL دسترسی نیست (شبکه‌ی Podman/Docker یا SHOP_DOMAIN/ پورت).',
  'core-unreachable-open':
    'Core در دسترس نیست ولی CORE_FAIL_MODE=open است — سایت باز می‌ماند؛ وضعیت را در Core بررسی کنید.',
  'core-key-rejected':
    'CORE_API_KEY فروشگاه با کلید Core (env یا تنظیمات پنل) یکی نیست — هر دو باید یک مقدار باشند.',
  'core-error':
    'Core پاسخ معتبر نداد (کد HTTP یا بدنه‌ی غیر-JSON) — جزئیات در core.error؛ سرویس Core و CORE_API_URL را چک کنید.',
  'db-missing':
    'اعتبار دامنه تأیید شد ولی فایل دیتابیس همان دامنه در مسیر سایت نیست — وضعیت provision در Core (ستون دیتابیس) و mount حجم داده را چک کنید.',
  ok: 'همه‌چیز این دامنه سالم است؛ اگر باز مسدود شدید کش ۱۵ دقیقه‌ای را در نظر بگیرید.',
};

export async function GET(request: NextRequest) {
  const expected = coreApiKey();
  const provided = request.headers.get('x-core-key') ?? '';
  if (!expected) {
    return NextResponse.json(
      { error: 'سرویس Core روی این فروشگاه تنظیم نشده است.' },
      { status: 403 }
    );
  }
  if (!keyEquals(provided, expected)) {
    return NextResponse.json({ error: 'کلید API نامعتبر است.' }, { status: 401 });
  }

  const host = request.headers.get('host');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const queryDomain = normalizeDomain(request.nextUrl.searchParams.get('domain'));
  // دامنه‌ی هر درخواست مستقل است — هیچ کش/حالت مشترکی بین دامنه‌ها وجود ندارد.
  const resolvedDomain = queryDomain || resolveSiteDomain({ host, forwardedHost }) || '';

  const failMode = coreFailMode();
  const dbRelative = resolvedDomain ? siteDbRelativePath(resolvedDomain) : '';
  const dbAbsolute = dbRelative ? path.join(process.cwd(), dbRelative) : '';
  const dbExists = dbAbsolute ? existsSync(dbAbsolute) : false;
  let dbSizeBytes: number | null = null;
  if (dbExists) {
    try {
      dbSizeBytes = statSync(dbAbsolute).size;
    } catch {
      dbSizeBytes = null;
    }
  }

  // آیا پوشه‌ی دیتابیس همین دامنه روی دیسک هست؟ («فایل نیست» را از «پروویژن
  // به مسیر دیگری رفته» جدا می‌کند.) فهرست دامنه‌های دیگر عمداً برنمی‌گردد:
  // این API نباید ابزار شمارش/کاوش فروشگاه‌های دیگر باشد.
  const dbDir = resolvedDomain
    ? path.join(process.cwd(), 'data', 'sites', sanitizeSiteDir(resolvedDomain))
    : '';
  const dbDirExists = dbDir ? existsSync(dbDir) : false;

  const core: CoreProbe = resolvedDomain
    ? await probeCore(resolvedDomain)
    : {
        configured: coreConfigured(),
        url: coreApiUrl(),
        reachable: false,
        elapsedMs: 0,
        error: 'دامنه‌ای برای استعلام وجود ندارد.',
      };

  let verdict: string;
  if (!resolvedDomain) {
    verdict = 'domain-not-resolved';
  } else if (!core.configured) {
    verdict = failMode === 'closed' ? 'core-not-configured' : 'open-core-not-configured';
  } else if (!core.reachable) {
    verdict = failMode === 'closed' ? 'core-unreachable-closed' : 'core-unreachable-open';
  } else if (core.httpStatus === 401) {
    verdict = 'core-key-rejected';
  } else if (core.ok === false) {
    verdict = `license-${core.status ?? 'unknown'}`;
  } else if (core.ok !== true) {
    // پاسخ ناسالم از Core: ۴۰۳/۴۰۴/۵۰۰ یا ۲۰۰ با بدنه‌ی غیر-JSON.
    verdict = 'core-error';
  } else if (!dbExists) {
    verdict = 'db-missing';
  } else {
    verdict = 'ok';
  }

  return NextResponse.json({
    domain: resolvedDomain || null,
    verdict,
    hint: VERDICT_HINTS[verdict] ?? 'وضعیت را با پشتیبانی بررسی کنید.',
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? null,
      isProduction: isProductionRuntime(),
      failMode,
      shopDomain: process.env.SHOP_DOMAIN ?? null,
      coreApiUrl: core.url || null,
      coreApiKey: maskKey(coreApiKey()),
    },
    request: {
      host,
      forwardedHost,
      xSiteDomain: request.headers.get('x-site-domain'),
      queryDomain: queryDomain || null,
      resolvedDomain: resolvedDomain || null,
    },
    core,
    siteDb: {
      relativePath: dbRelative,
      absolutePath: dbAbsolute,
      dirPath: dbDir,
      dirExists: dbDirExists,
      exists: dbExists,
      sizeBytes: dbSizeBytes,
    },
  });
}
