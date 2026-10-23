/**
 * MiniPay BNPL gateway (خرید اعتباری مینی‌پی), ported from the C# IpgFactory
 * implementation (MiniPayGateway.cs).
 *
 * Flow:
 *  1. POST https://v1.minipay.me/api/pg/request with { amount (Rial),
 *     callback_url, merchant_id, items: { itemName, itemCode, quantity,
 *     unitPrice, discount, vat, amount } } → success is Error: null; the
 *     first value of Data is the payment authority.
 *  2. Redirect the customer to https://ipg.minipay.me/?authority={authority}.
 *  3. The gateway redirects back with the authority (our stored token).
 *  4. POST /api/pg/verify as multipart/form-data with the authority field →
 *     Data non-null = settled.
 *
 * Amounts are in Rial — order amounts here are Toman, so ×10.
 */

import {
  type GatewayStartContext,
  type GatewayStartResult,
  type GatewayVerifyContext,
  type GatewayVerifyResult,
} from './types';

const API_BASE = 'https://v1.minipay.me/api/pg';
const PAY_URL = 'https://ipg.minipay.me/';

interface MiniPayEnvelope {
  Error?: { message?: string; Message?: string } | null;
  Data?: Record<string, unknown> | null;
}

export async function minipayStart(ctx: GatewayStartContext): Promise<GatewayStartResult> {
  const amountRial = ctx.amountToman * 10;

  let payload: MiniPayEnvelope;
  try {
    const response = await fetch(`${API_BASE}/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        amount: amountRial,
        callback_url: ctx.callbackUrl,
        merchant_id: ctx.settings.minipayMerchantId,
        // MiniPay takes a single item object; the whole purchase is one line.
        items: {
          itemName: ctx.description ?? 'سفارش',
          itemCode: ctx.providerId,
          quantity: 1,
          unitPrice: amountRial,
          discount: 0,
          vat: 0,
          amount: amountRial,
        },
      }),
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    payload = (await response.json()) as MiniPayEnvelope;
  } catch {
    return { ok: false, error: 'ارتباط با درگاه مینی‌پی برقرار نشد. کمی بعد دوباره تلاش کنید.' };
  }

  if (payload.Error === null || payload.Error === undefined) {
    const data = payload.Data ?? {};
    const authority =
      (typeof data.authority === 'string' && data.authority) ||
      Object.values(data).find((value) => typeof value === 'string' && value !== '');

    if (typeof authority === 'string' && authority !== '') {
      return {
        ok: true,
        redirectUrl: `${PAY_URL}?authority=${encodeURIComponent(authority)}`,
        token: authority,
        providerId: ctx.providerId,
      };
    }
  }

  const message =
    payload.Error && typeof payload.Error === 'object'
      ? (payload.Error.message ?? payload.Error.Message)
      : undefined;
  return { ok: false, error: message ?? 'ایجاد درخواست پرداخت مینی‌پی ناموفق بود.' };
}

export async function minipayVerify(ctx: GatewayVerifyContext): Promise<GatewayVerifyResult> {
  const authority = ctx.params.authority ?? ctx.token;
  if (!authority) {
    return { ok: false, error: 'شناسه پرداخت مینی‌پی در پاسخ درگاه نبود.' };
  }

  // The verify endpoint takes multipart/form-data, not JSON.
  let payload: MiniPayEnvelope;
  try {
    const form = new FormData();
    form.append('authority', authority);
    const response = await fetch(`${API_BASE}/verify`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    payload = (await response.json()) as MiniPayEnvelope;
  } catch {
    return { ok: false, error: 'ارتباط با درگاه مینی‌پی برای تأیید تراکنش برقرار نشد.' };
  }

  if (payload.Data !== null && payload.Data !== undefined) {
    return { ok: true, refId: authority };
  }

  const message =
    payload.Error && typeof payload.Error === 'object'
      ? (payload.Error.message ?? payload.Error.Message)
      : undefined;
  return { ok: false, error: message ?? 'تأیید پرداخت مینی‌پی ناموفق بود.' };
}
