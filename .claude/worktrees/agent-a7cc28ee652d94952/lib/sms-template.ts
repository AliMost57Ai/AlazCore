/**
 * The after-payment SMS text: an admin-editable template with placeholders.
 *
 * Pure string work (no Prisma, no server APIs) so both the admin config form
 * (client) and the payment callback (server) can use it. The same placeholder
 * substitution also fills Mediana pattern parameters — each parameter value is
 * itself a mini-template like '{order}'.
 */

/** One pattern parameter of a Mediana pattern: panel field key → mini-template. */
export interface SmsPatternParam {
  key: string;
  value: string;
}

/** Placeholders usable in the SMS templates and in pattern parameter values. */
export const SMS_PLACEHOLDERS: { token: string; label: string }[] = [
  { token: '{order}', label: 'شماره سفارش' },
  { token: '{amount}', label: 'مبلغ سفارش' },
  { token: '{refId}', label: 'کد پیگیری پرداخت' },
  { token: '{delivery}', label: 'یادداشت ارسال' },
  { token: '{date}', label: 'تاریخ سفارش' },
  { token: '{tracking}', label: 'کد رهگیری مرسوله' },
  { token: '{link}', label: 'لینک پرداخت (فقط پیامک لینک پرداخت)' },
  { token: '{code}', label: 'کد یکبار مصرف (فقط پیامک کد ورود)' },
];

/** The values substituted for the placeholders above. */
export interface SmsTemplateValues {
  order: string;
  amount: string;
  refId: string;
  delivery: string;
  date: string;
  tracking: string;
  /** The shareable payment link — only the payment-link SMS uses it. */
  link?: string;
  /** The one-time login code — only the login-OTP SMS uses it. */
  code?: string;
}

/** Used when the admin has not saved a template of their own. */
export const DEFAULT_SMS_TEMPLATE = [
  'پرداخت سفارش {order} با مبلغ {amount} انجام شد.',
  'کد پیگیری پرداخت: {refId}',
  'ارسال با تیپاکس — {delivery}.',
].join('\n');

/** Default text for the shipping-notice SMS sent when the order is posted. */
export const DEFAULT_SMS_NOTICE_TEMPLATE = [
  'سفارش {order} ارسال شد.',
  'کد رهگیری مرسوله: {tracking}',
  'ارسال با تیپاکس — {delivery}.',
].join('\n');

/** Default text for the shareable payment-link SMS (sent to another person). */
export const DEFAULT_PAYMENT_LINK_TEMPLATE = [
  'برای مشاهده و پرداخت فاکتور سفارش {order} به مبلغ {amount} از لینک زیر استفاده کنید:',
  '{link}',
].join('\n');

/** Default text for the login one-time-code SMS (sent at the OTP login step). */
export const DEFAULT_OTP_TEMPLATE = 'کد ورود شما: {code}';

/**
 * Replaces every {token} with its value; unknown tokens stay untouched so a
 * typo is visible in the preview instead of silently disappearing.
 */
export function renderSmsTemplate(template: string, values: SmsTemplateValues): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key as keyof SmsTemplateValues];
    return value !== undefined ? value : match;
  });
}

/** Sample values for the live preview in the admin config form. */
export const SAMPLE_SMS_VALUES: SmsTemplateValues = {
  order: 'ORD-72411',
  amount: '۴٬۸۵۰٬۰۰۰ تومان',
  refId: '۱۲۳۴۵۶',
  delivery: 'حداقل تحویل ۳ روز بعد از پرداخت سفارش',
  date: '۱۴۰۵/۰۶/۱۶',
  tracking: 'TIP-92413577',
  link: 'https://shop.example.ir/pay/8f3c9a1b2d4e6f70',
  code: '۱۲۳۴۵۶',
};
