/**
 * Sadad online payment gateway, ported from the C# IpgFactory implementation.
 *
 * Every request is signed with TripleDES-ECB (PKCS7) using the base64
 * terminal key: signData = base64(3DES("{terminalId};{orderId};{amount}")).
 * The verify call signs just the token.
 *
 * Flow:
 *  1. POST https://sadad.shaparak.ir/api/v0/Request/PaymentRequest with
 *     { merchantId, terminalId, amount (Rial), orderId (numeric long),
 *     localDateTime, returnUrl, signData } → ResCode 0 + Token.
 *  2. Redirect to https://sadad.shaparak.ir/Purchase/index?token={Token}.
 *  3. The gateway redirects back with the OrderId (and token).
 *  4. POST /api/v0/Advice/Verify with { token, signData } → ResCode 0,
 *     RetrivalRefNo and the verified Amount.
 *
 * Amounts are in Rial — order amounts here are Toman, so ×10. The orderId
 * must be a numeric long, so the driver generates its own (epoch millis) and
 * reports it back as the providerId — the callback echoes it.
 */

import { createCipheriv } from 'node:crypto';
import {
  postJson,
  type GatewayStartContext,
  type GatewayStartResult,
  type GatewayVerifyContext,
  type GatewayVerifyResult,
} from './types';

const REQUEST_URL = 'https://sadad.shaparak.ir/api/v0/Request/PaymentRequest';
const VERIFY_URL = 'https://sadad.shaparak.ir/api/v0/Advice/Verify';
const PAY_URL = 'https://sadad.shaparak.ir/Purchase/index';

/** signData = base64(TripleDES-ECB-PKCS7(terminalKey, payload)). The key is
 *  the base64 terminal key — 24-byte (168-bit) keys use 3-key 3DES, 16-byte
 *  (112-bit) keys use the 2-key variant, exactly like .NET's TripleDES. */
function sign(terminalKeyBase64: string, payload: string): string {
  const key = Buffer.from(terminalKeyBase64, 'base64');
  const cipher = createCipheriv(key.length === 16 ? 'des-ede' : 'des-ede3', key, null);
  return Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]).toString('base64');
}

interface SadadRequestResponse {
  ResCode?: number | string;
  Description?: string;
  Token?: string;
}

interface SadadVerifyResponse {
  ResCode?: number | string;
  Amount?: number;
  RetrivalRefNo?: number | string;
  SystemTraceNo?: number | string;
  Description?: string;
}

export async function sadadStart(ctx: GatewayStartContext): Promise<GatewayStartResult> {
  // Sadad requires a numeric order id — epoch millis is unique enough and
  // is what gets echoed back on the callback.
  const orderId = Date.now();
  const amountRial = ctx.amountToman * 10;
  // The terminal id stays a string: leading zeros (and the signed payload)
  // must match what the bank issued, digit for digit.
  const terminalId = ctx.settings.sadadTerminalId.trim();

  let signData: string;
  try {
    signData = sign(ctx.settings.sadadTerminalKey, `${terminalId};${orderId};${amountRial}`);
  } catch {
    return { ok: false, error: 'کلید ترمینال سداد نامعتبر است (باید یک کلید base64 معتبر باشد).' };
  }

  let payload: SadadRequestResponse;
  try {
    // Field names/casing follow the provider's own contract (camelCase,
    // terminalId a string) — the C# client serializes exactly this shape.
    payload = await postJson(
      REQUEST_URL,
      {
        terminalId,
        merchantId: ctx.settings.sadadMerchantId.trim(),
        amount: amountRial,
        orderId,
        localDateTime: new Date().toISOString(),
        returnUrl: ctx.callbackUrl,
        signData,
      },
      // The gateway checks the referring site against the merchant.
      { Referer: ctx.callbackUrl }
    );
  } catch (error) {
    return {
      ok: false,
      error: 'ارتباط با درگاه سداد برقرار نشد. کمی بعد دوباره تلاش کنید.',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  if (String(payload.ResCode ?? '') === '0' && payload.Token) {
    return {
      ok: true,
      redirectUrl: `${PAY_URL}?token=${encodeURIComponent(payload.Token)}`,
      token: payload.Token,
      providerId: String(orderId),
    };
  }

  return {
    ok: false,
    error:
      payload.Description ?? `ایجاد درخواست پرداخت سداد ناموفق بود (کد ${payload.ResCode ?? '?'}).`,
  };
}

export async function sadadVerify(ctx: GatewayVerifyContext): Promise<GatewayVerifyResult> {
  const token = ctx.params.token ?? ctx.token;
  if (!token) {
    return { ok: false, error: 'توکن پرداخت سداد در پاسخ درگاه نبود.' };
  }

  let signData: string;
  try {
    signData = sign(ctx.settings.sadadTerminalKey, token);
  } catch {
    return { ok: false, error: 'کلید ترمینال سداد نامعتبر است.' };
  }

  let payload: SadadVerifyResponse;
  try {
    // The verify contract sends a lowercase `token` — same as the C# client.
    payload = await postJson(VERIFY_URL, { token, SignData: signData });
  } catch (error) {
    return {
      ok: false,
      error: 'ارتباط با درگاه سداد برای تأیید تراکنش برقرار نشد.',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  if (String(payload.ResCode ?? '') === '0') {
    const refId = payload.RetrivalRefNo
      ? String(payload.RetrivalRefNo)
      : payload.SystemTraceNo
        ? String(payload.SystemTraceNo)
        : token;
    return { ok: true, refId, amountRial: payload.Amount };
  }

  return {
    ok: false,
    error: payload.Description ?? `تأیید پرداخت سداد ناموفق بود (کد ${payload.ResCode ?? '?'}).`,
  };
}
