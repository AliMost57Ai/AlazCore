/**
 * «چرا این درخواست به /site-inactive رفت؟» — مدل دلیل مسدودسازی و پیام فارسی
 * متناظر آن.
 *
 * پیش از این، صفحه‌ی تعلیق علت را از نو حدس می‌زد: اگر لایسنس null بود (دامنه
 * resolve نشده، یا Core خاموش با CORE_FAIL_MODE=open) یا وضعیت 'active' بود
 * (لایسنس سالم ولی دیتابیس سایت موجود نبود) به کلید `unknown` می‌افتاد و پیام
 * «این دامنه در سامانه ثبت نشده است» را نشان می‌داد — حتی وقتی دامنه ثبت شده و
 * معتبر بود. الان دلیل واقعی از proxy می‌آید (reason/status در query) و این
 * ماژول همان دلیل را به متن دقیق تبدیل می‌کند؛ هر مسیر جدیدی هم باید از همین
 * نگاشت رد شود تا دوباره پیام گمراه‌کننده ساخته نشود.
 *
 * ماژول کاملاً خالص است (فقط type-import) تا در تست و سمت کلاینت/سرور بی‌خطر
 * باشد. هیچ حالتی از این ماژول بین دامنه‌ها مشترک نیست: ورودی، وضعیت همان
 * درخواست است و خروجی فقط متن.
 */

import type { CoreLicense } from './core-license';

/** گیت‌های مسدودکننده در proxy.ts — هر سه منبع این صفحه‌اند. */
export type SiteBlockKind = 'domain' | 'db' | 'license';

/**
 * وضعیت‌های مسدودکننده‌ی لایسنس؛ 'unverified' یعنی «نتوانستیم بررسی کنیم»
 * (لایسنس null) — عمداً از 'unknown' («Core گفت ثبت نشده») جدا است.
 */
export type LicenseBlockStatus = 'unknown' | 'inactive' | 'suspended' | 'expired' | 'unverified';

export interface SiteBlock {
  kind: SiteBlockKind;
  /** فقط برای kind === 'license'. */
  status?: LicenseBlockStatus;
  /** Core پاسخ سالم نداد (timeout/401/پیکربندی) — پیام «سرویس در دسترس نیست». */
  serviceDown?: boolean;
}

export interface SiteBlockCopy {
  title: string;
  body: string;
  /** کد کوتاه لاتین برای پشتیبانی/لاگ — هم روی صفحه، هم در لاگ سرور. */
  code: string;
  /** راهنمای کوتاه مدیر (روی صفحه با رنگ کم‌رنگ نمایش داده می‌شود). */
  hint?: string;
}

/** پیام‌های همان چهار وضعیت قبلی لایسنس — متن عمداً تغییر نکرده. */
const LICENSE_COPY: Record<Exclude<LicenseBlockStatus, 'unverified'>, SiteBlockCopy> = {
  unknown: {
    title: 'این دامنه در سامانه ثبت نشده است',
    body:
      'دامنه‌ی شما مجوز استفاده از فروشگاه‌ساز AlazCore را ندارد. برای ثبت، با پشتیبانی در تماس باشید.',
    code: 'license:unknown',
  },
  inactive: {
    title: 'این فروشگاه غیرفعال شده است',
    body:
      'سرویس این فروشگاه توسط مدیریت سامانه غیرفعال شده است. برای پیگیری با پشتیبانی AlazCore تماس بگیرید.',
    code: 'license:inactive',
  },
  suspended: {
    title: 'این فروشگاه موقتاً تعلیق شده است',
    body:
      'این سایت توسط پشتیبانی تعلیق شده است. دلیل آن معمولاً در تیکت‌های پنل مالک ثبت شده است.',
    code: 'license:suspended',
  },
  expired: {
    title: 'اعتبار پلن این فروشگاه به پایان رسیده است',
    body: 'برای فعال‌سازی مجدد سایت، پلن خود را از پنل مدیریت AlazCore تمدید کنید.',
    code: 'license:expired',
  },
};

/**
 * دیتابیس دامنه در Core هنوز `pending` است (provision کامل نشده) — پیام
 * اختصاصی خودش، نه «حالا آماده شد» و نه «ثبت‌نشده».
 */
export const DB_PENDING_COPY: SiteBlockCopy = {
  title: 'فروشگاه در حال آماده‌سازی است',
  body:
    'دیتابیس اختصاصی این سایت در حال ساخت است. چند دقیقه بعد دوباره تلاش کنید؛ اگر ادامه داشت با پشتیبانی تماس بگیرید.',
  code: 'db:pending',
  hint:
    'مدیر سایت: ستون «دیتابیس» همین دامنه در پنل Core باید ready شود. اگر pending ماند، دکمه‌ی تلاش مجدد provision را بزنید.',
};

/**
 * ورود مستقیم به /site-inactive بدون دلیلِ از-پراکسی، در حالی که لایسنس همین
 * دامنه سالم است — اینجا هیچ چیز خراب نیست؛ پیام «دیتابیس نیست» دروغ می‌شد.
 */
export const DIRECT_COPY: SiteBlockCopy = {
  title: 'وضعیت این فروشگاه مشکلی ندارد',
  body:
    'این صفحه مخصوص فروشگاه‌هایی است که اعتبار یا دیتابیسشان تأیید نشده است. برای دیدن فروشگاه به صفحه‌ی اصلی برگردید.',
  code: 'direct',
};

/**
 * دلیل گیت لایسنس — null یعنی «این گیت بلاک نمی‌کند» (Core تنظیم نشده، یا
 * لایسنس ok، یا CORE_FAIL_MODE=open و Core پاسخ نداده است). تصمیم fail-mode
 * همان‌جا در lib/core-license.ts گرفته می‌شود و اینجا تکرار نمی‌شود.
 */
export function blockForLicense(license: CoreLicense | null): SiteBlock | null {
  if (!license || license.ok) {
    return null;
  }
  if (license.serviceDown) {
    return { kind: 'license', serviceDown: true };
  }
  const status = license.status;
  if (
    status === 'unknown' ||
    status === 'inactive' ||
    status === 'suspended' ||
    status === 'expired'
  ) {
    return { kind: 'license', status };
  }
  // پاسخ نامتعارف Core — «قابل تأیید نبود»، نه «ثبت‌نشده».
  return { kind: 'license', status: 'unverified' };
}

/** کد یکتای دلیل — مبنای لاگ و نمایش به پشتیبانی. */
export function blockCode(block: SiteBlock): string {
  if (block.kind !== 'license') {
    return block.kind;
  }
  if (block.serviceDown) {
    return 'license:down';
  }
  return `license:${block.status ?? 'unverified'}`;
}

export function blockCopy(block: SiteBlock): SiteBlockCopy {
  if (block.kind === 'domain') {
    return {
      title: 'دامنه‌ی این فروشگاه شناسایی نشد',
      body:
        'درخواست بدون دامنه‌ی معتبر به سرور رسید. اگر این سایت روی دامنه‌ی خودش تنظیم شده، پراکسی/Host درست به اپ نمی‌رسد.',
      code: 'domain',
      hint:
        'مدیر سرور: پراکسی باید هدر Host را عیناً پاس بدهد (nginx: proxy_set_header Host $host). برای تست محلی، SHOP_DOMAIN را در .env ست کنید — فقط در محیط توسعه.',
    };
  }
  if (block.kind === 'db') {
    return {
      title: 'فروشگاه هنوز روی این سرور آماده نیست',
      body: 'اعتبار این دامنه تأیید شد، اما دیتابیس اختصاصی آن روی این سرور پیدا نشد.',
      code: 'db',
      hint:
        'مدیر سایت: وضعیت «دیتابیس» دامنه را در پنل Core بررسی کنید (باید ready باشد)؛ اگر ready است ولی فایل نیست، مسیر volume داده‌ی فروشگاه روی سرور درست mount نشده است.',
    };
  }
  if (block.serviceDown) {
    return {
      title: 'سرویس موقتاً در دسترس نیست',
      body:
        'در این لحظه امکان بررسی اعتبار فروشگاه توسط سامانه AlazCore وجود ندارد. چند لحظه بعد دوباره تلاش کنید؛ اگر ادامه داشت با پشتیبانی تماس بگیرید.',
      code: 'license:down',
      hint:
        'مدیر سرور: CORE_API_URL و CORE_API_KEY را چک کنید. با CORE_FAIL_MODE=closed نبودِ Core سایت را مسدود می‌کند؛ در محیط توسعه می‌توانید open بگذارید.',
    };
  }
  const status = block.status ?? 'unverified';
  if (status === 'unverified') {
    return {
      title: 'وضعیت این فروشگاه قابل تأیید نیست',
      body:
        'در این لحظه امکان بررسی اعتبار این دامنه وجود ندارد. چند لحظه بعد دوباره تلاش کنید؛ اگر ادامه داشت با پشتیبانی تماس بگیرید.',
      code: 'license:unverified',
      hint: 'مدیر سرور: وضعیت لایسنس را با سرویس /api/validate در Core بررسی کنید.',
    };
  }
  return LICENSE_COPY[status];
}

/**
 * پارامترهای query برای ریدایرکت proxy → /site-inactive. عمداً فقط داده‌ی
 * غیرحساس (نوع دلیل و وضعیت) منتقل می‌شود.
 */
export function blockSearchParams(block: SiteBlock): Record<string, string> {
  const params: Record<string, string> = { reason: block.kind };
  if (block.kind === 'license') {
    if (block.serviceDown) {
      params.down = '1';
    } else if (block.status) {
      params.status = block.status;
    }
  }
  return params;
}

/** خواندن دلیل از query صفحه — ورودی نامعتبر = null (fallback به وضعیت لایسنس). */
export function blockFromQuery(query: {
  reason?: string;
  status?: string;
  down?: string;
}): SiteBlock | null {
  const reason = query.reason;
  if (reason === 'domain' || reason === 'db') {
    return { kind: reason };
  }
  if (reason !== 'license') {
    return null;
  }
  if (query.down === '1') {
    return { kind: 'license', serviceDown: true };
  }
  const status = query.status;
  if (
    status === 'unknown' ||
    status === 'inactive' ||
    status === 'suspended' ||
    status === 'expired' ||
    status === 'unverified'
  ) {
    return { kind: 'license', status };
  }
  return { kind: 'license', status: 'unverified' };
}
