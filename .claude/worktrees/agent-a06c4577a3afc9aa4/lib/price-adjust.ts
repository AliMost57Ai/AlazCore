/**
 * Pure, client-safe pieces of the batch price-update feature
 * (Finance → به‌روزرسانی قیمت). No DB import here, so the client-side
 * preview and the server-side apply share the exact same arithmetic.
 */

import { faNumber } from './format';

export type PriceAdjustType = 'fixed' | 'percent';
export type PriceUpdateScope = 'category' | 'product';

/** One planned price move — the preview row and the history row share this shape. */
export interface PlannedPriceChange {
  productId: string;
  productName: string;
  /** Null = the product's own price (not a variant). */
  variantId: string | null;
  variantName: string | null;
  oldPrice: number;
  newPrice: number;
}

/** Persian label for an adjustment, e.g. «۱۰٪ افزایش» or «۵۰٬۰۰۰ تومان کاهش». */
export function describeAdjust(adjustType: PriceAdjustType, adjustValue: number): string {
  const direction = adjustValue >= 0 ? 'افزایش' : 'کاهش';
  const abs = Math.abs(adjustValue);
  if (adjustType === 'percent') {
    return `${faNumber(abs)}٪ ${direction}`;
  }
  return `${faNumber(abs)} تومان ${direction}`;
}

/** fixed → old + value; percent → old + value% of old. Clamped at 0 Toman. */
export function computeNewPrice(
  oldPrice: number,
  adjustType: PriceAdjustType,
  adjustValue: number
): number {
  const next =
    adjustType === 'percent'
      ? Math.round((oldPrice * (100 + adjustValue)) / 100)
      : oldPrice + adjustValue;
  return Math.max(0, next);
}
