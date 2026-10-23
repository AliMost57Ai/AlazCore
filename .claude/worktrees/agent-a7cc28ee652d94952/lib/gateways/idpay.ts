/**
 * IdPay online payment gateway (IPG), per https://idpay.ir/web-api/v1.1
 *
 * Flow:
 *  1. POST https://api.idpay.ir/v1.1/payment (X-API-KEY header) with
 *     { order_id, amount (Rial), phone, callback } → HTTP 201 { id, link }.
 *  2. Redirect the customer to `link`.
 *  3. The gateway redirects back with ?id=…&order_id=… (our providerId).
 *  4. POST /v1.1/payment/verify { order_id, id } → status 100 = verified,
 *     101 = already verified; anything else failed.
 *
 * Amounts are in Rial — order amounts here are Toman, so ×10. Sandbox mode
 * sends the X-SANDBOX: 1 header instead of 0.
 */

import {
  postJson,
  type GatewayStartContext,
  type GatewayStartResult,
  type GatewayVerifyContext,
  type GatewayVerifyResult,
} from './types';

const API_BASE = 'https://api.idpay.ir/v1.1';

interface IdPayPaymentResponse {
  id?: string;
  link?: string;
  error_message?: string;
}

interface IdPayVerifyResponse {
  status?: number;
  track_id?: number | string;
  amount?: number;
  error_message?: string;
}

export async function idpayStart(ctx: GatewayStartContext): Promise<GatewayStartResult> {
  let payload: IdPayPaymentResponse;
  try {
    payload = await postJson(
      `${API_BASE}/payment`,
      {
        order_id: ctx.providerId,
        amount: ctx.amountToman * 10,
        phone: ctx.mobile ?? undefined,
        callback: ctx.callbackUrl,
        desc: ctx.description,
      },
      {
        'X-API-KEY': ctx.settings.idpayApiKey,
        'X-SANDBOX': ctx.settings.idpaySandbox ? '1' : '0',
      }
    );
  } catch {
    return { ok: false, error: 'ارتباط با درگاه آیدی‌پی برقرار نشد. کمی بعد دوباره تلاش کنید.' };
  }

  if (payload.id && payload.link) {
    return { ok: true, redirectUrl: payload.link, token: payload.id, providerId: ctx.providerId };
  }

  return { ok: false, error: payload.error_message ?? 'ایجاد درخواست پرداخت آیدی‌پی ناموفق بود.' };
}

export async function idpayVerify(ctx: GatewayVerifyContext): Promise<GatewayVerifyResult> {
  // The gateway's payment id — from the callback, or the one stored at start.
  const id = ctx.params.id ?? ctx.token;
  if (!id) {
    return { ok: false, error: 'شناسه پرداخت آیدی‌پی در پاسخ درگاه نبود.' };
  }

  let payload: IdPayVerifyResponse;
  try {
    payload = await postJson(
      `${API_BASE}/payment/verify`,
      { order_id: ctx.providerId, id },
      {
        'X-API-KEY': ctx.settings.idpayApiKey,
        'X-SANDBOX': ctx.settings.idpaySandbox ? '1' : '0',
      }
    );
  } catch {
    return { ok: false, error: 'ارتباط با درگاه آیدی‌پی برای تأیید تراکنش برقرار نشد.' };
  }

  // 100 = verified now, 101 = already verified (callback retried).
  if ((payload.status === 100 || payload.status === 101) && payload.track_id) {
    return { ok: true, refId: String(payload.track_id), amountRial: payload.amount };
  }

  return { ok: false, error: payload.error_message ?? 'تأیید پرداخت آیدی‌پی ناموفق بود.' };
}
