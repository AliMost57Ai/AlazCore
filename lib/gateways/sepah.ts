/**
 * Sepah bank (OmidPay / امیدپی) online payment gateway, ported from the C#
 * IpgFactory implementation.
 *
 * Flow:
 *  1. POST https://ref.omidpayment.ir/ref-payment/RestServices/mts/
 *     generateTokenWithNoSign/ with { WSContext: { UserId, Password },
 *     TransType: 'EN_GOODS', ReserveNum, MerchantId, TerminalId, Amount
 *     (Rial, string), RedirectUrl, MobileNo } → Result 'erSucceed' + Token.
 *  2. The browser must form-POST the token to
 *     https://omid.shaparak.ir/_ipgw_/MainTemplate/payment/ (fields: token,
 *     language: 'fa') — a plain redirect does not work, hence postUrl +
 *     postFields on the start result.
 *  3. The gateway redirects back with the RefNum (and our ReserveNum).
 *  4. POST .../mts/verifyMerchantTrans/ with { WSContext, RefNum, Token } →
 *     Result 'erSucceed'.
 *
 * Amounts are in Rial — order amounts here are Toman, so ×10.
 */

import {
  postJson,
  type GatewayStartContext,
  type GatewayStartResult,
  type GatewayVerifyContext,
  type GatewayVerifyResult,
} from './types';

const BASE = 'https://ref.omidpayment.ir/ref-payment/RestServices/mts';

interface SepahTokenResponse {
  Result?: string;
  Token?: string;
  RefNum?: string;
  ResultDescription?: string;
}

interface SepahVerifyResponse {
  Result?: string;
  ResultDescription?: string;
}

export async function sepahStart(ctx: GatewayStartContext): Promise<GatewayStartResult> {
  let payload: SepahTokenResponse;
  try {
    payload = await postJson(`${BASE}/generateTokenWithNoSign/`, {
      WSContext: {
        UserId: ctx.settings.sepahMerchantId,
        Password: ctx.settings.sepahPassword,
      },
      TransType: 'EN_GOODS',
      ReserveNum: ctx.providerId,
      MerchantId: ctx.settings.sepahMerchantId,
      TerminalId: ctx.settings.sepahTerminalId,
      Amount: String(ctx.amountToman * 10),
      RedirectUrl: ctx.callbackUrl,
      MobileNo: ctx.mobile ?? '',
      Email: '',
    });
  } catch {
    return {
      ok: false,
      error: 'ارتباط با درگاه سپه (امیدپی) برقرار نشد. کمی بعد دوباره تلاش کنید.',
    };
  }

  if (payload.Result === 'erSucceed' && payload.Token) {
    return {
      ok: true,
      // The browser form-POSTs the token to the payment page.
      redirectUrl: 'https://omid.shaparak.ir/_ipgw_/MainTemplate/payment/',
      postUrl: 'https://omid.shaparak.ir/_ipgw_/MainTemplate/payment/',
      postFields: { token: payload.Token, language: 'fa' },
      token: payload.Token,
      providerId: ctx.providerId,
    };
  }

  return {
    ok: false,
    error: payload.ResultDescription ?? 'ایجاد درخواست پرداخت سپه (امیدپی) ناموفق بود.',
  };
}

export async function sepahVerify(ctx: GatewayVerifyContext): Promise<GatewayVerifyResult> {
  // The callback carries the bank's RefNum; the token is the stored one.
  const refNum = ctx.params.refnum ?? '';
  const token = ctx.params.token ?? ctx.token;
  if (!token) {
    return { ok: false, error: 'توکن پرداخت سپه (امیدپی) در دسترس نیست.' };
  }

  let payload: SepahVerifyResponse;
  try {
    payload = await postJson(`${BASE}/verifyMerchantTrans/`, {
      WSContext: {
        UserId: ctx.settings.sepahMerchantId,
        Password: ctx.settings.sepahPassword,
      },
      RefNum: refNum,
      Token: token,
    });
  } catch {
    return { ok: false, error: 'ارتباط با درگاه سپه (امیدپی) برای تأیید تراکنش برقرار نشد.' };
  }

  if (payload.Result === 'erSucceed') {
    return { ok: true, refId: refNum || (token as string) };
  }

  return {
    ok: false,
    error: payload.ResultDescription ?? 'تأیید پرداخت سپه (امیدپی) ناموفق بود.',
  };
}
