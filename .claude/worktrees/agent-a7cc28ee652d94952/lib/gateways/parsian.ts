/**
 * Parsian (PEC) online payment gateway — a SOAP service, ported from the
 * C# IpgFactory implementation.
 *
 * Flow:
 *  1. SOAP SalePaymentRequest on https://pec.shaparak.ir/NewIPGServices/Sale/
 *     SaleService.asmx with { LoginAccount (PIN), Amount (Rial), OrderId,
 *     CallBackUrl } → Status 0 + a positive Token.
 *  2. Redirect the customer to https://pec.shaparak.ir/NewIPG/?token={Token}.
 *  3. The gateway redirects back with the Token and our OrderId.
 *  4. SOAP ConfirmPayment on .../Confirm/ConfirmService.asmx with
 *     { LoginAccount, Token } → Status 0 + positive RRN = settled.
 *
 * Amounts are in Rial — order amounts here are Toman, so ×10. The OrderId
 * must be a numeric long, so the driver generates its own (epoch millis) and
 * reports it back as the providerId — the callback echoes it.
 */

import {
  postSoap,
  soapEnvelope,
  soapTag,
  xmlEscape,
  type GatewayStartContext,
  type GatewayStartResult,
  type GatewayVerifyContext,
  type GatewayVerifyResult,
} from './types';

const SALE_URL = 'https://pec.shaparak.ir/NewIPGServices/Sale/SaleService.asmx';
const CONFIRM_URL = 'https://pec.shaparak.ir/NewIPGServices/Confirm/ConfirmService.asmx';
const PAY_URL = 'https://pec.shaparak.ir/NewIPG/';
// Element/action namespaces exactly as the PEC WSDL declares them — note the
// capital "S" in Shaparak and the trailing /SaleService (//ConfirmService)
// segment. The .asmx dispatcher is case-sensitive on these.
const SALE_NS = 'https://pec.Shaparak.ir/NewIPGServices/Sale/SaleService';
const CONFIRM_NS = 'https://pec.Shaparak.ir/NewIPGServices/Confirm/ConfirmService';

export async function parsianStart(ctx: GatewayStartContext): Promise<GatewayStartResult> {
  // Parsian requires a numeric order id — epoch millis is unique enough and
  // is what gets echoed back on the callback.
  const orderId = String(Date.now());
  const amountRial = ctx.amountToman * 10;

  const xml = soapEnvelope(
    [
      `<SalePaymentRequest xmlns="${SALE_NS}">`,
      '<requestData>',
      `<LoginAccount>${xmlEscape(ctx.settings.parsianPin)}</LoginAccount>`,
      `<Amount>${amountRial}</Amount>`,
      `<OrderId>${orderId}</OrderId>`,
      `<CallBackUrl>${xmlEscape(ctx.callbackUrl)}</CallBackUrl>`,
      '</requestData>',
      '</SalePaymentRequest>',
    ].join('')
  );

  let responseXml: string;
  try {
    responseXml = await postSoap(SALE_URL, `${SALE_NS}/SalePaymentRequest`, xml);
  } catch (error) {
    return {
      ok: false,
      error: 'ارتباط با درگاه پارسیان برقرار نشد. کمی بعد دوباره تلاش کنید.',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const status = Number(soapTag(responseXml, 'Status') ?? NaN);
  const token = soapTag(responseXml, 'Token');
  const message = soapTag(responseXml, 'Message') ?? '';

  if (status === 0 && token && Number(token) > 0) {
    return {
      ok: true,
      redirectUrl: `${PAY_URL}?token=${encodeURIComponent(token)}`,
      token,
      providerId: orderId,
    };
  }

  return {
    ok: false,
    error:
      message ||
      `ایجاد درخواست پرداخت پارسیان ناموفق بود (کد ${Number.isNaN(status) ? '?' : status}).`,
    detail: responseXml.replace(/\s+/g, ' ').slice(0, 500),
  };
}

export async function parsianVerify(ctx: GatewayVerifyContext): Promise<GatewayVerifyResult> {
  // The token comes back on the callback; fall back to the stored one.
  const token = ctx.params.token ?? ctx.token;
  if (!token) {
    return { ok: false, error: 'توکن پرداخت پارسیان در پاسخ درگاه نبود.' };
  }

  const xml = soapEnvelope(
    [
      `<ConfirmPayment xmlns="${CONFIRM_NS}">`,
      '<requestData>',
      `<LoginAccount>${xmlEscape(ctx.settings.parsianPin)}</LoginAccount>`,
      `<Token>${xmlEscape(token)}</Token>`,
      '</requestData>',
      '</ConfirmPayment>',
    ].join('')
  );

  let responseXml: string;
  try {
    responseXml = await postSoap(CONFIRM_URL, `${CONFIRM_NS}/ConfirmPayment`, xml);
  } catch (error) {
    return {
      ok: false,
      error: 'ارتباط با درگاه پارسیان برای تأیید تراکنش برقرار نشد.',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const status = Number(soapTag(responseXml, 'Status') ?? NaN);
  const rrn = soapTag(responseXml, 'RRN');

  // Status 0 with a positive RRN (reference number) means settled.
  if (status === 0 && rrn && Number(rrn) > 0) {
    return { ok: true, refId: rrn };
  }

  return {
    ok: false,
    error: `تأیید پرداخت پارسیان ناموفق بود (کد ${Number.isNaN(status) ? '?' : status}).`,
    detail: responseXml.replace(/\s+/g, ' ').slice(0, 500),
  };
}
