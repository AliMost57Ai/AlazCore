/** ثابت‌های پنل Core و کاتالوگ‌های مشترک (درگاه/پیامک/تم). */

export const SESSION_COOKIE = 'core_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // یک هفته

/** Provider idهای پنل پیامکی — هم‌نام با libهای فروشگاه (farazsms, mediana…). */
export const SMS_PROVIDERS: { id: string; label: string }[] = [
  { id: 'smsir', label: 'SMS.ir' },
  { id: 'mediana', label: 'مدیانا' },
  { id: 'melipayamak', label: 'ملی‌پیامک' },
  { id: 'payamresan', label: 'پیام رسان' },
  { id: 'farazsms', label: 'فراز اس‌ام‌اس' },
];

/** درگاه‌های پرداخت کاتالوگ — هم‌نام با lib/gateways/registry.ts فروشگاه. */
export const GATEWAY_CATALOG: { id: string; label: string; kind: 'ipg' | 'bnpl' }[] = [
  { id: 'zarinpal', label: 'زرین‌پال', kind: 'ipg' },
  { id: 'idpay', label: 'آی‌دی‌پی', kind: 'ipg' },
  { id: 'mellat', label: 'بانک ملت (به‌پرداخت)', kind: 'ipg' },
  { id: 'parsian', label: 'بانک پارسیان', kind: 'ipg' },
  { id: 'pasargad', label: 'بانک پاسارگاد', kind: 'ipg' },
  { id: 'sadad', label: 'بانک ملت (سداد)', kind: 'ipg' },
  { id: 'saman', label: 'بانک سامان (سپ)', kind: 'ipg' },
  { id: 'sepah', label: 'بانک سپه', kind: 'ipg' },
  { id: 'sizpay', label: 'سیزپی', kind: 'ipg' },
  { id: 'digipay', label: 'دیجی‌پی', kind: 'bnpl' },
  { id: 'vibe', label: 'وایب', kind: 'bnpl' },
  { id: 'keepa', label: 'کیپا', kind: 'bnpl' },
  { id: 'fakher', label: 'فاخر', kind: 'bnpl' },
  { id: 'snapppay', label: 'اسنپ‌پی', kind: 'bnpl' },
  { id: 'tara', label: 'تارا', kind: 'bnpl' },
  { id: 'minipay', label: 'مینی‌پی', kind: 'bnpl' },
];

export const TICKET_STATUSES: { value: string; label: string; color: string }[] = [
  { value: 'open', label: 'باز', color: 'orange' },
  { value: 'answered', label: 'پاسخ داده شده', color: 'blue' },
  { value: 'pending', label: 'درانتظار فروشگاه', color: 'grape' },
  { value: 'closed', label: 'بسته', color: 'gray' },
];

export const PRIORITIES: { value: string; label: string; color: string }[] = [
  { value: 'low', label: 'کم', color: 'gray' },
  { value: 'normal', label: 'عادی', color: 'blue' },
  { value: 'high', label: 'فوری', color: 'red' },
];
