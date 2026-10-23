/**
 * Client-safe payment display labels — pure data with NO server imports, so
 * client components (OnlinePaymentsTable) don't pull prisma/next-headers
 * into the client bundle. DTO types stay in lib/wallet.ts (import type).
 */

/** Persian labels for the payment-attempt states. */
export const PAYMENT_STATE_LABELS = {
  pending: 'در انتظار',
  verified: 'موفق',
  failed: 'ناموفق',
} as const;

/** Persian labels for the payment-attempt kinds. */
export const PAYMENT_KIND_LABELS = {
  wallet_charge: 'شارژ کیف پول',
  order_payment: 'پرداخت سفارش',
} as const;

/**
 * برچسب فارسی درگاه‌ها — نسخه client-safe (registry کامل server-side است و
 * درایورها را به باندل کلاینت می‌کشد). کلید ناشناخته = خود id.
 */
export const GATEWAY_LABELS: Record<string, string> = {
  zarinpal: 'زرین‌پال',
  idpay: 'آیدی‌پی',
  parsian: 'پارسیان',
  mellat: 'ملت',
  saman: 'سامان',
  sadad: 'سداد',
  sepah: 'سپه',
  sizpay: 'سیزپی',
  keepa: 'کیپا',
  minipay: 'مینی‌پی',
  pasargad: 'پاسارگاد',
  digipay: 'دیجی‌پی',
  snapppay: 'اسنپ‌پی',
  tara: 'تارا',
  vibe: 'وایب',
  fakher: 'فاخر',
};

export function gatewayLabel(id: string): string {
  return GATEWAY_LABELS[id] ?? id;
}

/** برچسب فارسی اطلاعات تأیید درگاه (کلیدهای انگلیسی verifyPayload). */
export const VERIFY_INFO_LABELS: Record<string, string> = {
  cardPan: 'شماره کارت',
  fee: 'کارمزد (ریال)',
  feeType: 'کارمزد بر عهده',
  amount: 'مبلغ (ریال)',
  trackingCode: 'کد پیگیری',
  message: 'پیام درگاه',
};
