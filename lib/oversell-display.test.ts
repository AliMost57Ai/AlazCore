/**
 * تست وضعیت نمایش خالی‌فروشی در ویترین (lib/oversell-display) و پارسر خطوط
 * شناسه‌دار سفارش (lib/order-cancel) — مبنای «ناموجود پس از اتمام سهمیه» و
 * «حذف قلم / آزادسازی سهمیه».
 */

import { parseOrderLinesWithIds } from './order-cancel';
import { oversellDisplayState } from './oversell-display';

describe('oversellDisplayState', () => {
  const base = { oversellAllowed: true, oversellMax: 1 as number | null, oversellEnabled: true };

  it('موجودی مثبت همیشه «موجود» است', () => {
    expect(oversellDisplayState({ ...base, stock: 3 })).toBe('in_stock');
    expect(oversellDisplayState({ ...base, oversellAllowed: false, stock: 2 })).toBe('in_stock');
  });

  it('بدون مجوز خالی‌فروشی (کالا یا فروشگاه) صفر یعنی «ناموجود»', () => {
    expect(oversellDisplayState({ ...base, oversellAllowed: false, stock: 0 })).toBe('sold_out');
    expect(oversellDisplayState({ ...base, oversellEnabled: false, stock: 0 })).toBe('sold_out');
  });

  it('سهمیه باز (کسری کمتر از سقف) یعنی خالی‌فروشی قابل خرید', () => {
    expect(oversellDisplayState({ ...base, stock: 0 })).toBe('oversell');
    // سقف ۱ — یک فروخته (stock=-1) هنوز... نه: کسری=۱=سقف یعنی تمام.
    expect(oversellDisplayState({ ...base, stock: -1 })).toBe('sold_out');
  });

  it('با سقف ۳، تا کسری ۲ سهمیه باز می‌ماند و در کسری ۳ تمام می‌شود', () => {
    expect(oversellDisplayState({ ...base, oversellMax: 3, stock: -2 })).toBe('oversell');
    expect(oversellDisplayState({ ...base, oversellMax: 3, stock: -3 })).toBe('sold_out');
  });

  it('سقف null یعنی بدون سقف کالایی — خالی‌فروشی تا سقف فروشگاه باز می‌ماند', () => {
    expect(oversellDisplayState({ ...base, oversellMax: null, stock: -5 })).toBe('oversell');
  });
});

describe('parseOrderLinesWithIds', () => {
  it('خطوط سالم را با شناسه برمی‌گرداند', () => {
    const json = JSON.stringify([
      { productId: 'p1', variantId: null, name: 'کالا', qty: 2, unitPrice: 1000 },
      { productId: 'p2', variantId: 'v1', name: 'کالا ۲', qty: 1, unitPrice: 500 },
    ]);
    const lines = parseOrderLinesWithIds(json);
    expect(lines).toEqual([
      { productId: 'p1', variantId: null, qty: 2, unitPrice: 1000 },
      { productId: 'p2', variantId: 'v1', qty: 1, unitPrice: 500 },
    ]);
  });

  it('ردیف خراب/بدون شناسه را رد می‌کند و JSON شکسته خالی است', () => {
    expect(parseOrderLinesWithIds('not-json')).toEqual([]);
    expect(parseOrderLinesWithIds(JSON.stringify([{ qty: 1 }]))).toEqual([]);
  });
});
