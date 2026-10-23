/**
 * Fakher BNPL gateway (خرید اقساطی فاخر / FakherSep), ported from the C#
 * IpgFactory implementation (FakherGateway.cs).
 *
 * There is no "create payment" API call: the customer is sent straight to a
 * hosted page with everything in the query string:
 *
 *   https://fakhersep.com/vpos/?terminalNumber=…&merchantNationalCode=…
 *     &amount={Rial}&orderId={providerId}&revertUrl={callback}
 *
 * The gateway redirects back with our orderId; settlement is then checked
 * through the Shanlicard report service:
 *
 *   POST https://portal.shanlicard.net:9603/fkhr-trx-report/service/report/trx
 *   { Name: 'get-transaction-status', Json: true,
 *     Params: [terminalNumber, orderId, persianSmallDate] }
 *   → { Count, Results: [{ responseCode, traceNo, amount, … }] }
 *   responseCode 0 = paid.
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

const VPOS_URL = 'https://fakhersep.com/vpos/';
const REPORT_URL = 'https://portal.shanlicard.net:9603/fkhr-trx-report/service/report/trx';

interface FakherReportResponse {
  Count?: number;
  Results?: {
    responseCode?: number | string;
    traceNo?: number | string;
    amount?: number;
    transactionDate?: string;
  }[];
  Message?: string;
}

export async function fakherStart(ctx: GatewayStartContext): Promise<GatewayStartResult> {
  const url = new URL(VPOS_URL);
  url.searchParams.set('terminalNumber', ctx.settings.fakherTerminalNumber);
  url.searchParams.set('merchantNationalCode', ctx.settings.fakherNationalCode);
  url.searchParams.set('amount', String(ctx.amountToman * 10));
  url.searchParams.set('orderId', ctx.providerId);
  url.searchParams.set('revertUrl', ctx.callbackUrl);

  return { ok: true, redirectUrl: url.toString(), providerId: ctx.providerId };
}

export async function fakherVerify(ctx: GatewayVerifyContext): Promise<GatewayVerifyResult> {
  let payload: FakherReportResponse;
  try {
    payload = await postJson(REPORT_URL, {
      Name: 'get-transaction-status',
      Json: true,
      Params: [ctx.settings.fakherTerminalNumber, ctx.providerId, ctx.createdJalali],
    });
  } catch {
    return { ok: false, error: 'ارتباط با سرویس گزارش فاخر برقرار نشد.' };
  }

  const first = payload.Results?.[0];
  if (String(first?.responseCode ?? '') === '0') {
    return {
      ok: true,
      refId: first?.traceNo ? String(first.traceNo) : ctx.providerId,
      amountRial: first?.amount,
    };
  }

  return {
    ok: false,
    error:
      payload.Message ??
      `وضعیت تراکنش فاخر قابل تأیید نیست (کد ${first?.responseCode ?? payload.Count ?? '?'}).`,
  };
}
