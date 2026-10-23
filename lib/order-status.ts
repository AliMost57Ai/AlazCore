/**
 * Order status UI constants — in their own module (no Prisma import) so
 * client components can use them without pulling the DB client into the
 * browser bundle. Re-exported by lib/orders.ts for existing importers.
 */

export type OrderStatus =
  | 'paid'
  | 'pending'
  | 'boxing'
  | 'posted'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  paid: 'پرداخت شده',
  pending: 'در انتظار پرداخت',
  boxing: 'در حال بسته‌بندی',
  posted: 'ارسال شده',
  shipped: 'ارسال شده',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
};

/** Mantine colour keys. `paid`/`cancelled` pair with an icon in the UI. */
export const STATUS_COLORS: Record<OrderStatus, string> = {
  paid: 'green',
  pending: 'yellow',
  boxing: 'violet',
  posted: 'blue',
  shipped: 'blue',
  delivered: 'teal',
  cancelled: 'red',
};

/**
 * Delivery sub-statuses shown on the customer's order card — the fine-grained
 * courier state underneath the order's main status.
 */
export type DeliverySubStatus = 'delivered' | 'stage2' | 'cancelled' | 'seller';

export const DELIVERY_SUB_STATUS_LABELS: Record<DeliverySubStatus, string> = {
  delivered: 'تحویل داده شد',
  stage2: 'مرحله ۲',
  cancelled: 'لغو شده',
  seller: 'نزد فروشنده',
};

/** The courier step the parcel is waiting on right now, per status. */
export const CURRENT_EVENT_LABELS: Partial<Record<OrderStatus, string>> = {
  pending: 'در انتظار پرداخت',
  paid: 'پرداخت تأیید شد',
  boxing: 'در حال بسته‌بندی',
  posted: 'تحویل به تیپاکس',
  shipped: 'تحویل به تیپاکس',
  delivered: 'تحویل به مشتری',
};

/** What happens next, per status — the "next step" row of the order card. */
export const NEXT_STEP_LABELS: Partial<Record<OrderStatus, string>> = {
  pending: 'پرداخت آنلاین',
  paid: 'بسته‌بندی توسط فروشگاه',
  boxing: 'تحویل به تیپاکس',
  posted: 'دریافت در تیپاکس',
  shipped: 'دریافت در تیپاکس',
};
