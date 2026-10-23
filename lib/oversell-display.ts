/**
 * وضعیت نمایش خالی‌فروشی در ویترین — تابع خالص بدون ایمپورت تا ProductView و
 * کارت‌های تم (سرور) و هر منطق دیگری یک قرارداد واحد داشته باشند؛ همان
 * جداسازی lib/return-status. سهمیه خالی‌فروشی = oversellMax + stock: با هر
 * فروشِ بدون موجودی، stock منفی می‌شود و رسیدن کسری به سقف یعنی سهمیه تمام.
 */

export type OversellDisplay = 'in_stock' | 'oversell' | 'sold_out';

export function oversellDisplayState(input: {
  stock: number;
  oversellAllowed: boolean;
  /** سقف خالی‌فروشی همین کالا؛ null = بدون سقف کالایی (سقف کل فروشگاه حاکم است). */
  oversellMax: number | null;
  oversellEnabled: boolean;
}): OversellDisplay {
  if (input.stock > 0) {
    return 'in_stock';
  }
  if (!input.oversellEnabled || !input.oversellAllowed) {
    return 'sold_out';
  }
  if (input.oversellMax != null && input.stock + input.oversellMax <= 0) {
    return 'sold_out';
  }
  return 'oversell';
}
