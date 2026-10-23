/**
 * Return-request UI constants — in their own module (no Prisma import) so
 * client components can use them without pulling the DB client into the
 * browser bundle. Same split as lib/order-status.ts.
 */

export type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'sent'
  | 'received'
  | 'refunded'
  | 'rejected'
  | 'cancelled';

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: 'ثبت شده',
  approved: 'تایید شده',
  sent: 'مدارک ارسال ثبت شد',
  received: 'کالا دریافت شد',
  refunded: 'واریز به کیف پول',
  rejected: 'رد شده',
  cancelled: 'لغو شده',
};

export const RETURN_STATUS_COLORS: Record<ReturnStatus, string> = {
  requested: 'yellow',
  approved: 'violet',
  sent: 'blue',
  received: 'indigo',
  refunded: 'green',
  rejected: 'red',
  cancelled: 'gray',
};

/** وضعیت‌هایی که سفارش را «در حال مرجوعی» نگه می‌دارند — بیشتر از یکی از
 * این‌ها برای یک سفارش هم‌زمان مجاز نیست. */
export const ACTIVE_RETURN_STATUSES: ReturnStatus[] = ['requested', 'approved', 'sent', 'received'];

/** دسته‌های علت مرجوعی — سلکت فرم درخواست. */
export const RETURN_REASON_LABELS = {
  defective: 'کالای معیوب یا خراب',
  damaged: 'آسیب‌دیده در حمل',
  mismatch: 'مغایرت با سفارش',
  regret: 'پشیمانی از خرید',
  other: 'سایر',
} as const;

export type ReturnReasonKind = keyof typeof RETURN_REASON_LABELS;

/** روش برگشت کالا — هنگام تایید توسط مالک تعیین می‌شود. */
export const RETURN_METHOD_LABELS = {
  self_ship: 'ارسال توسط مشتری',
  shop_courier: 'جمع‌آوری توسط فروشگاه (پیک مرجوعی)',
  in_person: 'مراجعه حضوری',
} as const;

export type ReturnMethod = keyof typeof RETURN_METHOD_LABELS;

/** پرداخت‌کننده هزینه ارسال برگشت. */
export const RETURN_SHIPPING_PAYER_LABELS = {
  customer: 'مشتری',
  shop: 'فروشگاه',
} as const;

export type ReturnShippingPayer = keyof typeof RETURN_SHIPPING_PAYER_LABELS;

/** یک قلم مرجوعی — اسنپ‌شات از itemsJson سفارش. */
export interface ReturnLine {
  productId: string;
  variantId: string | null;
  name: string;
  qty: number;
  unitPrice: number;
}

/**
 * مبلغ بازگشتی اقلام انتخابی — سهم تناسبی از مبلغ پرداختی کالاها نسبت به جمع
 * کل اقلام سفارش (کف به تومان)، با سقفِ همان مبلغ پرداختی. کل سفارش دقیقاً
 * amount − discountAmount برمی‌گرداند. تابع خالص — سمت سرور منبع حقیقت است و
 * فرم مشتری فقط برآورد نمایشی با همین فرمول می‌سازد.
 */
export function computeRefundAmount(
  selected: Pick<ReturnLine, 'qty' | 'unitPrice'>[],
  orderLines: Pick<ReturnLine, 'qty' | 'unitPrice'>[],
  paidGoodsTotal: number
): number {
  const totalGross = orderLines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
  const gross = selected.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
  if (totalGross <= 0 || gross <= 0 || paidGoodsTotal <= 0) {
    return 0;
  }
  return Math.min(Math.floor((gross * paidGoodsTotal) / totalGross), paidGoodsTotal);
}

/** برچسب مراحل تایم‌لاین مرجوعی — برای مشتری و پنل. */
export const RETURN_TIMELINE_LABELS: Record<ReturnStatus, string> = {
  requested: 'ثبت درخواست مرجوعی',
  approved: 'تایید فروشگاه',
  sent: 'ثبت مدارک ارسال',
  received: 'دریافت کالا',
  refunded: 'واریز به کیف پول',
  rejected: 'رد درخواست',
  cancelled: 'لغو درخواست',
};

/** «گام بعدی» از نگاه مشتری — بر اساس وضعیت و روش برگشت. */
export function customerNextStep(
  status: ReturnStatus,
  method: ReturnMethod | null,
  shippingPayer: ReturnShippingPayer | null
): string {
  switch (status) {
    case 'requested':
      return 'در انتظار بررسی فروشگاه';
    case 'approved':
      if (method === 'in_person') {
        return 'برای بازگرداندن کالا به فروشگاه مراجعه کنید';
      }
      if (method === 'shop_courier') {
        return 'بسته را آماده کنید — پیک فروشگاه برای دریافت مراجعه می‌کند';
      }
      return shippingPayer === 'shop'
        ? 'کالا را ارسال کنید و رسید و هزینه را در سایت ثبت کنید تا به کیف پولتان برگردد'
        : 'کالا را ارسال کنید و رسید مرسوله را در سایت ثبت کنید';
    case 'sent':
      return 'در انتظار دریافت کالا توسط فروشگاه';
    case 'received':
      return 'در انتظار تسویه و واریز به کیف پول';
    case 'refunded':
      return 'مبلغ به کیف پول شما واریز شد';
    case 'rejected':
      return 'این درخواست رد شده است';
    case 'cancelled':
      return 'این درخواست لغو شده است';
  }
}
