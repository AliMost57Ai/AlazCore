/**
 * Pasargad (PEP) online payment gateway, ported from the C# IpgFactory
 * implementation (PasargadGateway.cs).
 *
 * Flow:
 *  1. POST https://pep.shaparak.ir/dorsa1/token/getToken with
 *     { username (IPG code), password (merchant code) } → a JWT-ish token.
 *  2. POST https://pep.shaparak.ir/dorsa1/api/payment/purchase with the
 *     Bearer token and { amount (Rial), callbackApi, invoice (unique),
 *     invoiceDate (Jalali yyyy/MM/dd), serviceCode: 8, ServiceType:
 *     'PURCHASE', terminalNumber } → resultCode 0 + data.url to redirect to.
 *  3. The gateway redirects back with ?tref=…&iN=…&iD=… (our invoice number).
 *  4. POST /api/payment/confirm-transactions with the Bearer token and
 *     { invoice, urlId } → resultCode 0 = settled.
 *
 * Amounts are in Rial — order amounts here are Toman, so ×10. The invoice
 * number is the providerId: this driver generates "timestamp-displayId"
 * (unique per attempt) and reports it back — the callback echoes it (iN).
 */

import {
  postJson,
  toJalaliAscii,
  type GatewayStartContext,
  type GatewayStartResult,
  type GatewayVerifyContext,
  type GatewayVerifyResult,
} from './types';

const BASE = 'https://pep.shaparak.ir/dorsa1';

interface PasargadTokenResponse {
  token?: string;
  userName?: string;
  userId?: number;
  message?: string;
}

interface PasargadPurchaseResponse {
  resultCode?: number | string;
  resultMsg?: string;
  data?: {
    url?: string;
    urlId?: string;
    invoice?: string;
    referenceNumber?: string;
  };
}

interface PasargadConfirmResponse {
  resultCode?: number | string;
  resultMsg?: string;
  data?: unknown;
}

/** Fetches a fresh API token (username/password → Bearer). */
async function fetchToken(
  username: string,
  password: string
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    const payload = await postJson<PasargadTokenResponse>(`${BASE}/token/getToken`, {
      username,
      password,
    });
    if (!payload.token) {
      return { ok: false, error: 'دریافت توکن درگاه پاسارگاد ناموفق بود.' };
    }
    return { ok: true, token: payload.token };
  } catch {
    return { ok: false, error: 'ارتباط با درگاه پاسارگاد برقرار نشد. کمی بعد دوباره تلاش کنید.' };
  }
}

export async function pasargadStart(ctx: GatewayStartContext): Promise<GatewayStartResult> {
  const token = await fetchToken(ctx.settings.pasargadUsername, ctx.settings.pasargadPassword);
  if (!token.ok) {
    return token;
  }

  // Unique invoice number — echoed back on the callback as iN.
  const invoice = `${Date.now()}-${ctx.providerId}`;

  let payload: PasargadPurchaseResponse;
  try {
    payload = await postJson(
      `${BASE}/api/payment/purchase`,
      {
        amount: ctx.amountToman * 10,
        callbackApi: ctx.callbackUrl,
        description: ctx.description ?? '',
        invoice,
        invoiceDate: toJalaliAscii(new Date()),
        mobileNumber: ctx.mobile ?? '',
        payerMail: '',
        payerName: '',
        paymentCode: '',
        serviceCode: 8,
        ServiceType: 'PURCHASE',
        terminalNumber: Number(ctx.settings.pasargadTerminalCode) || 0,
        pans: '',
      },
      { Authorization: `Bearer ${token.token}` }
    );
  } catch {
    return { ok: false, error: 'ایجاد درخواست پرداخت پاسارگاد ناموفق بود.' };
  }

  if (String(payload.resultCode ?? '') === '0' && payload.data?.url) {
    return {
      ok: true,
      redirectUrl: payload.data.url,
      // urlId is required by the confirm call — keep it on the transaction.
      token: payload.data.urlId ?? '',
      providerId: invoice,
    };
  }

  return {
    ok: false,
    error:
      payload.resultMsg ??
      `ایجاد درخواست پرداخت پاسارگاد ناموفق بود (کد ${payload.resultCode ?? '?'}).`,
  };
}

export async function pasargadVerify(ctx: GatewayVerifyContext): Promise<GatewayVerifyResult> {
  // The callback echoes our invoice number (iN); fall back to the stored one.
  const invoice = ctx.params.in ?? ctx.providerId;
  const urlId = ctx.token ?? '';

  const token = await fetchToken(ctx.settings.pasargadUsername, ctx.settings.pasargadPassword);
  if (!token.ok) {
    return { ok: false, error: token.error };
  }

  let payload: PasargadConfirmResponse;
  try {
    payload = await postJson(
      `${BASE}/api/payment/confirm-transactions`,
      { invoice, urlId },
      { Authorization: `Bearer ${token.token}` }
    );
  } catch {
    return { ok: false, error: 'ارتباط با درگاه پاسارگاد برای تأیید تراکنش برقرار نشد.' };
  }

  if (String(payload.resultCode ?? '') === '0') {
    // tref = the bank's reference number on the callback.
    const refId = ctx.params.tref || invoice;
    return { ok: true, refId };
  }

  return {
    ok: false,
    error:
      payload.resultMsg ?? `تأیید پرداخت پاسارگاد ناموفق بود (کد ${payload.resultCode ?? '?'}).`,
  };
}
