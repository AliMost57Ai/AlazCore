/**
 * Saman (SEP) online payment gateway, ported from the C# IpgFactory
 * implementation.
 *
 * Flow:
 *  1. POST https://sep.shaparak.ir/onlinepg/onlinepg with
 *     { Action: 'token', TerminalId, Amount (Rial), ResNum (our providerId),
 *     RedirectUrl } → { Status: 1, Token } (or an ErrorCode/ErrorDesc pair).
 *  2. The browser must form-POST the token to
 *     https://sep.shaparak.ir/OnlinePG/OnlinePG (field: Token) — a plain
 *     redirect does not work, hence postUrl + postFields on the start result.
 *  3. The gateway redirects back with ?State=…&ResNum=…&RefNum=….
 *  4. POST https://sep.shaparak.ir/verifyTxnRandomSessionkey/ipg/
 *     VerifyTransaction with { Refnum, TerminalNumber } → Success: true and
 *     the transaction detail (RRN, original amount) on success.
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

const TOKEN_URL = 'https://sep.shaparak.ir/onlinepg/onlinepg';
const PAY_POST_URL = 'https://sep.shaparak.ir/OnlinePG/OnlinePG';
const VERIFY_URL = 'https://sep.shaparak.ir/verifyTxnRandomSessionkey/ipg/VerifyTransaction';

interface SamanTokenResponse {
  Status?: number;
  ErrorCode?: number | string;
  ErrorDesc?: string;
  Token?: string;
}

interface SamanVerifyResponse {
  Success?: boolean;
  ResultCode?: number | string;
  TransactionDetail?: {
    RRN?: number | string;
    RefNum?: string;
    OrginalAmount?: number;
  };
}

export async function samanStart(ctx: GatewayStartContext): Promise<GatewayStartResult> {
  let payload: SamanTokenResponse;
  try {
    payload = await postJson(TOKEN_URL, {
      Action: 'token',
      TerminalId: Number(ctx.settings.samanTerminalId),
      Amount: ctx.amountToman * 10,
      ResNum: ctx.providerId,
      RedirectUrl: ctx.callbackUrl,
      ...(ctx.mobile ? { CellNumber: ctx.mobile } : {}),
    });
  } catch {
    return { ok: false, error: 'ارتباط با درگاه سامان برقرار نشد. کمی بعد دوباره تلاش کنید.' };
  }

  if (payload.Status === 1 && payload.Token) {
    return {
      ok: true,
      // The browser form-POSTs the token to the payment page.
      redirectUrl: PAY_POST_URL,
      postUrl: PAY_POST_URL,
      postFields: { Token: payload.Token },
      token: payload.Token,
      providerId: ctx.providerId,
    };
  }

  return {
    ok: false,
    error:
      payload.ErrorDesc ??
      `ایجاد درخواست پرداخت سامان ناموفق بود (کد ${payload.ErrorCode ?? '?'}).`,
  };
}

export async function samanVerify(ctx: GatewayVerifyContext): Promise<GatewayVerifyResult> {
  // Verify takes the gateway token (Refnum in Saman's terms) — from the
  // callback's RefNum field, or the token stored at start.
  const refNum = ctx.params.refnum ?? ctx.token;
  if (!refNum) {
    return { ok: false, error: 'شناسه تراکنش سامان در پاسخ درگاه نبود.' };
  }

  let payload: SamanVerifyResponse;
  try {
    payload = await postJson(VERIFY_URL, {
      Refnum: refNum,
      TerminalNumber: Number(ctx.settings.samanTerminalId),
    });
  } catch {
    return { ok: false, error: 'ارتباط با درگاه سامان برای تأیید تراکنش برقرار نشد.' };
  }

  if (payload.Success === true) {
    const detail = payload.TransactionDetail ?? {};
    const refId = detail.RRN ? String(detail.RRN) : (detail.RefNum ?? refNum);
    return { ok: true, refId, amountRial: detail.OrginalAmount };
  }

  return {
    ok: false,
    error: `تأیید پرداخت سامان ناموفق بود (کد ${payload.ResultCode ?? '?'}).`,
  };
}
