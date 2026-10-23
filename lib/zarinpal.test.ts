/**
 * تست زرین‌پال — باگ «ایجاد درخواست پرداخت ناموفق بود» در sandbox: زرین‌پال
 * روی «موفقیت» هم errors را به‌صورت آرایه خالی `[]` برمی‌گرداند (تأیید واقعی
 * با sandbox از همین ماشین) و آرایه خالی در JS truthy است. این تست قفل
 * رفتار درست می‌کند: آرایه خالی = بی‌خطا.
 */

import { zarinpalRequest, zarinpalVerify } from './zarinpal';

const okRequestEnvelope = {
  data: {
    code: 100,
    authority: 'S00000000000000000000000000000m7deq3',
    fee: 3000,
    fee_type: 'Merchant',
    message: 'Success',
  },
  errors: [] as unknown[],
};

const okVerifyEnvelope = {
  data: {
    code: 100,
    ref_id: 123456,
    card_pan: '6037**********9219',
    fee: 3000,
    fee_type: 'Merchant',
  },
  errors: [] as unknown[],
};

function mockFetchOnce(payload: unknown, status = 200): jest.Mock {
  const fn = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => payload,
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const baseInput = {
  merchantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  sandbox: true,
  amountToman: 10000,
  callbackUrl: 'http://localhost:3000/api/payment/callback',
  description: 'تست',
};

describe('zarinpalRequest — آرایه خالی errors یعنی موفقیت', () => {
  it('پاسخ موفق sandbox با errors: [] باید authority بدهد، نه خطا', async () => {
    mockFetchOnce(okRequestEnvelope);
    const result = await zarinpalRequest(baseInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.authority).toBe('S00000000000000000000000000000m7deq3');
      expect(result.startPayUrl).toContain('sandbox.zarinpal.com/pg/StartPay/');
    }
  });

  it('errors: null و undefined هم موفقیت است', async () => {
    mockFetchOnce({ ...okRequestEnvelope, errors: null });
    const result = await zarinpalRequest(baseInput);
    expect(result.ok).toBe(true);

    const { errors: _omit, ...withoutErrors } = okRequestEnvelope as Record<string, unknown>;
    mockFetchOnce(withoutErrors);
    const second = await zarinpalRequest(baseInput);
    expect(second.ok).toBe(true);
  });

  it('خطای بیزینسی 422 با errors آبجکت‌شکل پیام فارسی می‌دهد', async () => {
    mockFetchOnce({ data: null, errors: { code: -12, message: 'تنظیمات ناقص' } }, 422);
    const result = await zarinpalRequest(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('تنظیمات درگاه پرداخت');
      expect(result.error).toContain('تنظیمات ناقص');
    }
  });

  it('آرایه خطای غیرخالی هم خطا است', async () => {
    mockFetchOnce({ data: null, errors: [{ code: -15, message: 'callback mismatch' }] });
    const result = await zarinpalRequest(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('آدرس بازگشت');
    }
  });
});

describe('zarinpalVerify — اطلاعات پرداخت پاسخ verify', () => {
  it('verify موفق card_pan و کارمزد را هم برمی‌گرداند', async () => {
    mockFetchOnce(okVerifyEnvelope);
    const result = await zarinpalVerify({ ...baseInput, authority: 'S000' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.refId).toBe('123456');
      expect(result.cardPan).toBe('6037**********9219');
      expect(result.feeRial).toBe(3000);
      expect(result.feeType).toBe('Merchant');
    }
  });

  it('کد 101 (تأیید قبلی) هم موفقیت است', async () => {
    mockFetchOnce({
      data: { code: 101, ref_id: 987654 },
      errors: [],
    });
    const result = await zarinpalVerify({ ...baseInput, authority: 'S000' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyVerified).toBe(true);
      expect(result.cardPan).toBeNull();
    }
  });
});
