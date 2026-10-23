/**
 * SizPay (سیزپی) online payment gateway, ported from the C# IpgFactory
 * implementation (SizPayGateway.cs + SizPayCrypto.cs).
 *
 * Every request is signed twice over a comma-joined payload:
 *   hmac   = base64(HMACSHA256(digitalSign, payload))
 *   sign   = base64(AES-CBC(secretKey1, secretKey2, payload + ',' + hmac))
 * The payment step signs the "{merchant},{terminal},{token}" triple instead.
 *
 * Flow:
 *  1. POST https://rt.sizpay.ir/api/Payment/GetToken with
 *     { MerchantID, TerminalID, Amount (Rial, string), DocDate (Jalali
 *     yyyy/MM/dd), OrderID, ReturnURL, ExtraInf, InvoiceNo, AppExtraInf,
 *     SignData } → ResCod '0' + Token.
 *  2. The browser must form-POST to https://rt.sizpay.ir/Route/Payment
 *     (fields: MerchantID, TerminalID, Token, SignData) — hence postUrl +
 *     postFields on the start result.
 *  3. The gateway redirects back with the token / our OrderID.
 *  4. POST /api/Payment/Confirm with { MerchantID, TerminalID, Token,
 *     SignData } → ResCod '0', Amount, RefNo/TraceNo.
 *
 * Amounts are in Rial — order amounts here are Toman, so ×10.
 */

import { createCipheriv, createHmac } from 'node:crypto';
import {
  postJson,
  toJalaliAscii,
  type GatewayStartContext,
  type GatewayStartResult,
  type GatewayVerifyContext,
  type GatewayVerifyResult,
} from './types';

const GET_TOKEN_URL = 'https://rt.sizpay.ir/api/Payment/GetToken';
const CONFIRM_URL = 'https://rt.sizpay.ir/api/Payment/Confirm';
const PAY_POST_URL = 'https://rt.sizpay.ir/Route/Payment';

/** AES-CBC(key1, iv=key2, PKCS7) of the payload → base64. */
function aesEncrypt(secretKey1: string, secretKey2: string, payload: string): string {
  const key = Buffer.from(secretKey1, 'base64');
  const iv = Buffer.from(secretKey2, 'base64');
  const cipher = createCipheriv(`aes-${key.length * 8}-cbc`, key, iv);
  return Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]).toString('base64');
}

/** The full SizPay signature over a comma-joined payload. */
function signData(
  keys: { key1: string; key2: string; digitalSign: string },
  payload: string
): string {
  const hmac = createHmac('sha256', keys.digitalSign).update(payload).digest('base64');
  return aesEncrypt(keys.key1, keys.key2, `${payload},${hmac}`);
}

interface SizPayTokenResponse {
  ResCod?: string | number;
  Message?: string;
  Token?: string;
}

interface SizPayConfirmResponse {
  ResCod?: string | number;
  Message?: string;
  Amount?: number | string;
  RefNo?: string;
  TraceNo?: string;
  TransNo?: string;
}

export async function sizpayStart(ctx: GatewayStartContext): Promise<GatewayStartResult> {
  const keys = {
    key1: ctx.settings.sizpaySecretKey1,
    key2: ctx.settings.sizpaySecretKey2,
    digitalSign: ctx.settings.sizpayDigitalSign,
  };

  // The signed payload — fixed field order per the provider's spec.
  const payload = [
    ctx.settings.sizpayMerchantId,
    ctx.settings.sizpayTerminalId,
    String(ctx.amountToman * 10),
    toJalaliAscii(new Date()),
    ctx.providerId,
    ctx.callbackUrl,
    '', // ExtraInf
    ctx.providerId, // InvoiceNo
  ].join(',');

  let sign: string;
  try {
    sign = signData(keys, payload);
  } catch {
    return {
      ok: false,
      error: 'کلیدهای رمزنگاری سیزپی نامعتبر هستند (باید مقادیر base64 معتبر باشند).',
    };
  }

  let response: SizPayTokenResponse;
  try {
    response = await postJson(GET_TOKEN_URL, {
      MerchantID: ctx.settings.sizpayMerchantId,
      TerminalID: ctx.settings.sizpayTerminalId,
      Amount: String(ctx.amountToman * 10),
      DocDate: toJalaliAscii(new Date()),
      OrderID: ctx.providerId,
      ReturnURL: ctx.callbackUrl,
      ExtraInf: '',
      InvoiceNo: ctx.providerId,
      AppExtraInf: {
        PayerNm: '',
        PayerMobile: ctx.mobile ?? '',
        PayerEmail: '',
        Descr: ctx.description ?? '',
        PayerIP: '',
        PayTitle: '',
      },
      SignData: sign,
    });
  } catch {
    return { ok: false, error: 'ارتباط با درگاه سیزپی برقرار نشد. کمی بعد دوباره تلاش کنید.' };
  }

  if (String(response.ResCod ?? '') === '0' && response.Token) {
    const token = response.Token;
    // The relay signature covers the merchant/terminal/token triple.
    let relaySign: string;
    try {
      relaySign = signData(
        keys,
        `${ctx.settings.sizpayMerchantId},${ctx.settings.sizpayTerminalId},${token}`
      );
    } catch {
      return { ok: false, error: 'کلیدهای رمزنگاری سیزپی نامعتبر هستند.' };
    }

    return {
      ok: true,
      // The browser form-POSTs to the payment route.
      redirectUrl: PAY_POST_URL,
      postUrl: PAY_POST_URL,
      postFields: {
        MerchantID: ctx.settings.sizpayMerchantId,
        TerminalID: ctx.settings.sizpayTerminalId,
        Token: token,
        SignData: relaySign,
      },
      token,
      providerId: ctx.providerId,
    };
  }

  return {
    ok: false,
    error:
      response.Message ?? `ایجاد درخواست پرداخت سیزپی ناموفق بود (کد ${response.ResCod ?? '?'}).`,
  };
}

export async function sizpayVerify(ctx: GatewayVerifyContext): Promise<GatewayVerifyResult> {
  const token = ctx.params.token ?? ctx.token;
  if (!token) {
    return { ok: false, error: 'توکن پرداخت سیزپی در پاسخ درگاه نبود.' };
  }

  let sign: string;
  try {
    sign = signData(
      {
        key1: ctx.settings.sizpaySecretKey1,
        key2: ctx.settings.sizpaySecretKey2,
        digitalSign: ctx.settings.sizpayDigitalSign,
      },
      `${ctx.settings.sizpayMerchantId},${ctx.settings.sizpayTerminalId},${token}`
    );
  } catch {
    return { ok: false, error: 'کلیدهای رمزنگاری سیزپی نامعتبر هستند.' };
  }

  let response: SizPayConfirmResponse;
  try {
    response = await postJson(CONFIRM_URL, {
      MerchantID: ctx.settings.sizpayMerchantId,
      TerminalID: ctx.settings.sizpayTerminalId,
      Token: token,
      SignData: sign,
    });
  } catch {
    return { ok: false, error: 'ارتباط با درگاه سیزپی برای تأیید تراکنش برقرار نشد.' };
  }

  if (String(response.ResCod ?? '') === '0') {
    const refId = response.RefNo || response.TraceNo || response.TransNo || token;
    const amountRial =
      response.Amount !== undefined && response.Amount !== null && response.Amount !== ''
        ? Number(response.Amount)
        : undefined;
    return {
      ok: true,
      refId,
      ...(Number.isFinite(amountRial) ? { amountRial } : {}),
    };
  }

  return {
    ok: false,
    error: response.Message ?? `تأیید پرداخت سیزپی ناموفق بود (کد ${response.ResCod ?? '?'}).`,
  };
}
