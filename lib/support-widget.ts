/**
 * ارائه ویجت چت فروشگاه (تنظیمات ← پشتیبانی) — پورت از نسخه مرجع.
 *
 * ادمین انتخاب می‌کند دکمه در کدام گوشه بنشیند، چطور ظاهر شود و حباب
 * خوش‌آمد نشان داده شود یا نه؛ ویجت فقط همان را رندر می‌کند.
 *
 * هر مقدار در دیتابیس رشته ساده است — FIELD_SPECS kind عددی ندارد — پس
 * resolver تنها جایی است که متن ذخیره‌شده را به مقدار تایپ‌شده تبدیل می‌کند
 * و ردیف دست‌کاری‌شده یا ناشناخته به‌جای شکستن ویجت، پیش‌فرض می‌خواند.
 */

import { fromFaDigits } from './format';

/** چهار گوشه صفحه که دکمه می‌تواند لنگر شود. */
export const WIDGET_POSITIONS = ['bottom-left', 'bottom-right', 'top-left', 'top-right'] as const;

export type SupportWidgetPosition = (typeof WIDGET_POSITIONS)[number];

/** برچسب فارسی گوشه‌ها برای سلکت ادمین. */
export const WIDGET_POSITION_LABELS: Record<SupportWidgetPosition, string> = {
  'bottom-left': 'پایین-چپ',
  'bottom-right': 'پایین-راست',
  'top-left': 'بالا-چپ',
  'top-right': 'بالا-راست',
};

/** نحوه ورود دکمه به صفحه. */
export const WIDGET_ANIMATIONS = ['none', 'fade', 'scale', 'slide', 'pop'] as const;

export type SupportWidgetAnimation = (typeof WIDGET_ANIMATIONS)[number];

export const WIDGET_ANIMATION_LABELS: Record<SupportWidgetAnimation, string> = {
  none: 'بدون انیمیشن (نمایش یک‌باره)',
  fade: 'محو شدن',
  scale: 'بزرگ شدن',
  slide: 'سریدن از لبه',
  pop: 'پاپ از گوشه',
};

/** پنج تنظیم ذخیره‌شده ویجت — همان شکلی که getAppSettings برمی‌گرداند. */
export interface SupportWidgetSettings {
  supportWidgetPosition: string;
  supportWidgetAnimation: string;
  /** ثانیه انتظار بعد از لود صفحه قبل از نمایش دکمه. */
  supportWidgetDelay: string;
  supportWidgetNoticeEnabled: boolean;
  /** ثانیه ماندن حباب خوش‌آمد پیش از بستن خودکار. */
  supportWidgetNoticeSeconds: string;
}

/** آنچه ویجت رندر می‌کند — حل‌شده، تایپ‌شده، به میلی‌ثانیه. */
export interface SupportWidgetConfig {
  position: SupportWidgetPosition;
  animation: SupportWidgetAnimation;
  /** انتظار بعد از لود صفحه؛ ۰ = دکمه از اولین رندر هست. */
  delayMs: number;
  /** آیا اصلاً حباب خوش‌آمد نشان داده شود. */
  noticeEnabled: boolean;
  /** مدت ماندن حباب؛ ۰ = تا بستن دستی باز می‌ماند. */
  noticeMs: number;
}

/** ثانیه‌ها همان‌طور ذخیره می‌شوند که API ادمین اعتبارسنجی می‌کند: حداکثر سه رقم. */
const MAX_WIDGET_SECONDS = 999;

/** وضعیت پیش‌فرض فروشگاهی که این تنظیمات را هرگز باز نکرده. */
export const DEFAULT_SUPPORT_WIDGET_CONFIG: SupportWidgetConfig = {
  position: 'bottom-left',
  animation: 'fade',
  delayMs: 0,
  noticeEnabled: true,
  noticeMs: 8_000,
};

/** متن خوش‌آمد پیش‌فرض وقتی ادمین آن را خالی گذاشته. */
export const DEFAULT_SUPPORT_WELCOME =
  'سلام! چطور می‌توانیم کمکتان کنیم؟ پیامتان را بنویسید تا در اولین فرصت پاسخ دهیم.';

/** آیا رشته ذخیره‌شده نام گوشه واقعی است (API ادمین هم مصرف می‌کند). */
export function isWidgetPosition(value: string): value is SupportWidgetPosition {
  return (WIDGET_POSITIONS as readonly string[]).includes(value);
}

/** آیا رشته ذخیره‌شده نام انیمیشن واقعی است (API ادمین هم مصرف می‌کند). */
export function isWidgetAnimation(value: string): value is SupportWidgetAnimation {
  return (WIDGET_ANIMATIONS as readonly string[]).includes(value);
}

/**
 * رشته ثانیه → ثانیه صحیح، یا پیش‌فرض وقتی غیرقابل استفاده است.
 * ارقام فارسی پذیرفته می‌شود (فیلد NumberInput)، و مقدار منفی یا بیرون از
 * بازه مثل «تنظیم‌نشده» رفتار می‌کند نه اینکه اطاعت شود.
 */
function widgetSeconds(value: string, fallback: number): number {
  const seconds = Number.parseInt(fromFaDigits(value).trim(), 10);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_WIDGET_SECONDS) {
    return fallback;
  }
  return seconds;
}

/**
 * تنظیمات ذخیره‌شده ویجت → آنچه ویجت رندر می‌کند. هرگز throw نمی‌کند:
 * گوشه یا انیمیشن ناشناخته به پیش‌فرض می‌خواند تا ردیف نیمه‌ذخیره‌شده فقط
 * ویجت ساده‌تری بسازد.
 */
export function resolveSupportWidgetConfig(settings: SupportWidgetSettings): SupportWidgetConfig {
  return {
    position: isWidgetPosition(settings.supportWidgetPosition)
      ? settings.supportWidgetPosition
      : DEFAULT_SUPPORT_WIDGET_CONFIG.position,
    animation: isWidgetAnimation(settings.supportWidgetAnimation)
      ? settings.supportWidgetAnimation
      : DEFAULT_SUPPORT_WIDGET_CONFIG.animation,
    delayMs: widgetSeconds(settings.supportWidgetDelay, 0) * 1000,
    noticeEnabled: settings.supportWidgetNoticeEnabled,
    noticeMs:
      widgetSeconds(
        settings.supportWidgetNoticeSeconds,
        DEFAULT_SUPPORT_WIDGET_CONFIG.noticeMs / 1000
      ) * 1000,
  };
}
