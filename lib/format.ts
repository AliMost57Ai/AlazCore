/**
 * Persian number formatting.
 *
 * Deliberately does not use `Intl.NumberFormat('fa-IR')`: ICU data can differ
 * between the Node build that renders on the server and the browser that
 * hydrates, which produces React hydration mismatches. These conversions are
 * pure string work, so server and client always agree.
 */

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

/** Persian thousands separator (U+066C). */
const FA_GROUP_SEPARATOR = '٬';
/** Persian decimal separator (U+066B). */
const FA_DECIMAL_SEPARATOR = '٫';

/** Converts every ASCII digit in a string to its Persian equivalent. */
export function toFaDigits(input: string | number): string {
  return String(input).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);
}

/**
 * Converts Persian (and Arabic) digits back to ASCII — the input-side twin.
 * Accepts `string | number`: form inputs and parsed values flow through here.
 */
export function fromFaDigits(input: string | number): string {
  return String(input)
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

/** `1234567` → `۱٬۲۳۴٬۵۶۷` */
export function faNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(fractionDigits);
  const [whole, fraction] = fixed.split('.');

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, FA_GROUP_SEPARATOR);
  const joined = fraction ? `${grouped}${FA_DECIMAL_SEPARATOR}${fraction}` : grouped;

  return `${negative ? '−' : ''}${toFaDigits(joined)}`;
}

/**
 * Compact form for stat tiles: `4200000` → `۴٫۲ میلیون`.
 * Keeps one decimal so a tile never rounds 1.9M down to "1 million", and drops
 * a trailing `.۰` so an exact million reads «۱ میلیون» instead of «۱٫۰ میلیون».
 */
export function faCompact(value: number): string {
  const abs = Math.abs(value);

  const compact = (divisor: number, unit: string): string => {
    const scaled = faNumber(value / divisor, 1);
    const trimmed = scaled.endsWith('٫۰') ? scaled.slice(0, -2) : scaled;
    return `${trimmed} ${unit}`;
  };

  if (abs >= 1_000_000_000) {
    return compact(1_000_000_000, 'میلیارد');
  }
  if (abs >= 1_000_000) {
    return compact(1_000_000, 'میلیون');
  }
  if (abs >= 1_000) {
    return compact(1_000, 'هزار');
  }

  return faNumber(value);
}

/** Money in Toman, compacted. */
export function faCurrency(value: number, compact = true): string {
  return `${compact ? faCompact(value) : faNumber(value)} تومان`;
}

/* ---------------------------------------------------------------------------
 * English-digit formatters — قرارداد بک‌آفیس (فروشگاه و کور): اعداد انگلیسی
 * با جداکنندهٔ هزارگان «,» برای خوانایی (1,234,567). عمداً بدون Intl — همان
 * استدلال ضد هیدراتیشن بالاست؛ گروه‌بندی regex خالص است تا سرور و مرورگر
 * همیشه یکسان ببینند. صفحات مشتری همان fa* فارسی‌رقم را می‌خوانند.
 * ------------------------------------------------------------------------ */

/** `1234567` → `1,234,567` */
export function enNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(fractionDigits);
  const [whole, fraction] = fixed.split('.');

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/** Compact stat tiles with English digits: `4200000` → `4.2 میلیون`. */
export function enCompact(value: number): string {
  const abs = Math.abs(value);

  const compact = (divisor: number, unit: string): string => {
    const scaled = enNumber(value / divisor, 1);
    const trimmed = scaled.endsWith('.0') ? scaled.slice(0, -2) : scaled;
    return `${trimmed} ${unit}`;
  };

  if (abs >= 1_000_000_000) {
    return compact(1_000_000_000, 'میلیارد');
  }
  if (abs >= 1_000_000) {
    return compact(1_000_000, 'میلیون');
  }
  if (abs >= 1_000) {
    return compact(1_000, 'هزار');
  }

  return enNumber(value);
}

/** Money in Toman with English digits — same call shape as faCurrency. */
export function enCurrency(value: number, compact = true): string {
  return `${compact ? enCompact(value) : enNumber(value)} تومان`;
}

/** `12.4` → `12.4%`, with an explicit sign for deltas. */
export function enPercent(value: number, { signed = false, fractionDigits = 1 } = {}): string {
  const sign = signed && value > 0 ? '+' : '';
  return `${sign}${enNumber(value, fractionDigits)}%`;
}

/**
 * Applies a percent discount to a Toman price, flooring the result so prices
 * stay whole Toman: `applyDiscount(48500000, 15)` → `41225000`.
 */
export function applyDiscount(price: number, discountPercent: number): number {
  if (!Number.isFinite(price) || price <= 0 || discountPercent <= 0) {
    return price;
  }
  return Math.floor((price * (100 - Math.min(discountPercent, 100))) / 100);
}

/** `12.4` → `۱۲٫۴٪`, with an explicit sign for deltas. */
export function faPercent(value: number, { signed = false, fractionDigits = 1 } = {}): string {
  const sign = signed && value > 0 ? '+' : '';
  return `${sign}${faNumber(value, fractionDigits)}٪`;
}

/* ---------------------------------------------------------------------------
 * Jalali calendar
 *
 * Same philosophy as the digit helpers: pure arithmetic, no `Intl` — so the
 * Gregorian→Jalali conversion (the jalaali-js algorithm) can never disagree
 * between server and browser.
 * ------------------------------------------------------------------------ */

const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

/** 1-based Jalali month number → month name. */
export function jalaliMonthName(month: number): string {
  return JALALI_MONTHS[Math.min(Math.max(month, 1), 12) - 1];
}

function div(a: number, b: number): number {
  return Math.floor(a / b);
}

/** Gregorian → Jalali as [year, month (1-12), day]. */
export function toJalali(date: Date): [year: number, month: number, day: number] {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const GREGORIAN_DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

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
    GREGORIAN_DAYS_BEFORE_MONTH[gm - 1];

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

  return [jy, month, day];
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** `new Date()` → `۱۴۰۳/۱۲/۲۴` — the format seeded orders use. */
export function faJalaliDate(date: Date): string {
  const [jy, jm, jd] = toJalali(date);
  return toFaDigits(`${jy}/${pad2(jm)}/${pad2(jd)}`);
}

/** Persian weekday names indexed by `Date.getDay()` (0 = Sunday). */
const PERSIAN_WEEKDAYS = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
  'شنبه',
] as const;

/** `new Date()` → `سه‌شنبه ۱۶ شهریور` — delivery estimates and the like. */
export function faJalaliLongDate(date: Date): string {
  const [, month, day] = toJalali(date);
  return `${PERSIAN_WEEKDAYS[date.getDay()]} ${toFaDigits(day)} ${jalaliMonthName(month)}`;
}
