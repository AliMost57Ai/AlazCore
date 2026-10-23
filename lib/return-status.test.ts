/**
 * تست منطق مرجوعی کالا — فرمول مبلغ تناسبی با سقف، اسنپ‌شات اقلام/عکس‌ها و
 * «گام بعدی» مشتری بر اساس وضعیت/روش (تسک «مرجوعی کالا»).
 * مسیرهای وابسته به دیتابیس (اهلیت، ترنزیشن‌ها، تسویه) طبق روال تسک‌ها
 * به‌صورت دستی روی سرور تست راستی‌آزمایی می‌شوند.
 */

import {
  computeRefundAmount,
  customerNextStep,
  RETURN_REASON_LABELS,
  type ReturnLine,
} from './return-status';

const orderLines: ReturnLine[] = [
  { productId: 'p1', variantId: null, name: 'کالفن', qty: 2, unitPrice: 500_000 },
  { productId: 'p2', variantId: 'v1', name: 'هدفون', qty: 1, unitPrice: 300_000 },
];

describe('computeRefundAmount — فرمول مبلغ مرجوعی', () => {
  it('مرجوعی کل سفارش دقیقاً مبلغ پرداختی کالاها (amount − تخفیف) را برمی‌گرداند', () => {
    const paidGoodsTotal = 1_200_000 - 100_000; // تخفیف کوپن ۱۰۰ هزار
    const all = orderLines.map((line) => ({ qty: line.qty, unitPrice: line.unitPrice }));
    expect(computeRefundAmount(all, all, paidGoodsTotal)).toBe(paidGoodsTotal);
  });

  it('مرجوعی جزئی سهم تناسبی از تخفیف را کسر می‌کند (کف تومان)', () => {
    // فقط کالفن ۲ عددی: نیمِ سفارش از مبلغ پرداختی
    const paidGoodsTotal = 1_100_000;
    const refund = computeRefundAmount(
      [{ qty: 2, unitPrice: 500_000 }],
      orderLines.map((line) => ({ qty: line.qty, unitPrice: line.unitPrice })),
      paidGoodsTotal
    );
    // gross=1,000,000 از totalGross=1,300,000 → floor(1,000,000 × 1,100,000 / 1,300,000)
    expect(refund).toBe(Math.floor((1_000_000 * paidGoodsTotal) / 1_300_000));
  });

  it('هرگز از مبلغ پرداختی عبور نمی‌کند', () => {
    const refund = computeRefundAmount([{ qty: 5, unitPrice: 999_999_999 }], orderLines, 500_000);
    expect(refund).toBe(500_000);
  });

  it('ورودی خالی یا سقف صفر، صفر برمی‌گرداند', () => {
    expect(computeRefundAmount([], orderLines, 100_000)).toBe(0);
    expect(computeRefundAmount([{ qty: 1, unitPrice: 100 }], orderLines, 0)).toBe(0);
  });
});

describe('customerNextStep — گام بعدی مشتری', () => {
  it('درخواست تازه → انتظار بررسی', () => {
    expect(customerNextStep('requested', null, null)).toBe('در انتظار بررسی فروشگاه');
  });

  it('تایید با روش خود-ارسال → ارسال کالا و ثبت رسید', () => {
    expect(customerNextStep('approved', 'self_ship', 'customer')).toContain('ارسال');
  });

  it('تایید پیک فروشگاه → آماده‌سازی بسته', () => {
    expect(customerNextStep('approved', 'shop_courier', null)).toContain('پیک فروشگاه');
  });

  it('تایید سفارش تحویل حضوری → مراجعه حضوری', () => {
    expect(customerNextStep('approved', 'in_person', null)).toContain('مراجعه');
  });

  it('مدارک ثبت‌شده → انتظار دریافت کالا', () => {
    expect(customerNextStep('sent', 'self_ship', 'shop')).toContain('دریافت کالا');
  });

  it('دریافت‌شده → انتظار تسویه و واریز', () => {
    expect(customerNextStep('received', 'in_person', null)).toContain('واریز');
  });

  it('تسویه‌شده → واریز انجام شد', () => {
    expect(customerNextStep('refunded', 'self_ship', 'shop')).toContain('واریز شد');
  });
});

describe('RETURN_REASON_LABELS — دسته‌های علت', () => {
  it('پنج دسته علت ثابت دارد', () => {
    expect(Object.keys(RETURN_REASON_LABELS)).toEqual([
      'defective',
      'damaged',
      'mismatch',
      'regret',
      'other',
    ]);
  });
});
