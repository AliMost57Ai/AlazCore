/**
 * Mellat (BPM) online payment gateway — a SOAP service, ported from the
 * C# IpgFactory implementation.
 *
 * Flow:
 *  1. SOAP bpPayRequest on https://bpm.shaparak.ir/pgwchannel/services/pgw
 *     with { terminalId, userName, userPassword, orderId, amount (Rial),
 *     localDate, localTime, callBackUrl, payerId: 0 } → the response is the
 *     string "resCode,RefId"; success = it contains the comma (resCode 0).
 *  2. Redirect to https://bpm.shaparak.ir/pgwchannel/payment.mellat?RefId={RefId}.
 *  3. The gateway form-POSTs the callback with RefId, SaleOrderId, ResCode,
 *     SaleReferenceId. ResCode 0 = approved by the bank.
 *  4. SOAP bpVerifyRequest (terminalId, userName, userPassword, orderId,
 *     saleOrderId, saleReferenceId) → "0" (or "43" = already verified), then
 *     bpSettleRequest with the same arguments to actually move the money.
 *
 * Amounts are in Rial — order amounts here are Toman, so ×10. The orderId
 * must be a numeric long, so the driver generates its own (epoch millis) and
 * reports it back as the providerId — the callback echoes it (SaleOrderId).
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

const SERVICE_URL = 'https://bpm.shaparak.ir/pgwchannel/services/pgw';
const PAY_URL = 'https://bpm.shaparak.ir/pgwchannel/payment.mellat';
// The WSDL-declared request element namespace — NOT the service URL (that
// was the bug). The SOAPAction is empty: the Axis service dispatches on the
// body element alone.
const OPERATION_NS = 'http://interfaces.core.sw.bps.com/';

function mellatRequestXml(operation: string, params: string[]): string {
  return soapEnvelope(
    [`<${operation} xmlns="${OPERATION_NS}">`, ...params, `</${operation}>`].join('')
  );
}

export async function mellatStart(ctx: GatewayStartContext): Promise<GatewayStartResult> {
  // Mellat requires a numeric order id — epoch millis is unique enough and
  // is what gets echoed back as SaleOrderId.
  const orderId = String(Date.now());
  const now = new Date();
  const pad = (value: number, size = 2): string => String(value).padStart(size, '0');
  const localDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const localTime = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const xml = mellatRequestXml('bpPayRequest', [
    `<terminalId>${xmlEscape(ctx.settings.mellatTerminalId)}</terminalId>`,
    `<userName>${xmlEscape(ctx.settings.mellatUsername)}</userName>`,
    `<userPassword>${xmlEscape(ctx.settings.mellatPassword)}</userPassword>`,
    `<orderId>${orderId}</orderId>`,
    `<amount>${ctx.amountToman * 10}</amount>`,
    `<localDate>${localDate}</localDate>`,
    `<localTime>${localTime}</localTime>`,
    '<additionalData></additionalData>',
    `<callBackUrl>${xmlEscape(ctx.callbackUrl)}</callBackUrl>`,
    '<payerId>0</payerId>',
  ]);

  let responseXml: string;
  try {
    responseXml = await postSoap(SERVICE_URL, '', xml);
  } catch (error) {
    return {
      ok: false,
      error: 'ارتباط با درگاه ملت برقرار نشد. کمی بعد دوباره تلاش کنید.',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  // The return value is the string "resCode,RefId".
  const raw = soapTag(responseXml, 'return') ?? '';
  const [resCode, refId] = raw.split(',').map((part) => part.trim());

  if (resCode === '0' && refId && refId !== '') {
    return {
      ok: true,
      redirectUrl: `${PAY_URL}?RefId=${encodeURIComponent(refId)}`,
      token: refId,
      providerId: orderId,
    };
  }

  return {
    ok: false,
    error: `ایجاد درخواست پرداخت ملت ناموفق بود (کد ${resCode || '?'}).`,
    detail: raw || responseXml.replace(/\s+/g, ' ').slice(0, 500),
  };
}

export async function mellatVerify(ctx: GatewayVerifyContext): Promise<GatewayVerifyResult> {
  // The callback (form-POST) carries the bank's reference numbers.
  const saleOrderId = ctx.params.saleorderid ?? ctx.providerId;
  const saleReferenceId = ctx.params.salereferenceid ?? '';
  const resCode = ctx.params.rescode ?? ctx.params.resultcode ?? '';

  if (resCode !== '0') {
    return { ok: false, error: `پرداخت ملت ناموفق بود (کد ${resCode || '?'}).` };
  }
  if (!saleReferenceId) {
    return { ok: false, error: 'شماره ارجاع پرداخت ملت در پاسخ درگاه نبود.' };
  }

  const auth = [
    `<terminalId>${xmlEscape(ctx.settings.mellatTerminalId)}</terminalId>`,
    `<userName>${xmlEscape(ctx.settings.mellatUsername)}</userName>`,
    `<userPassword>${xmlEscape(ctx.settings.mellatPassword)}</userPassword>`,
  ];

  // Verify: "0" = verified, "43" = already verified (callback retried).
  // The RPC signature is (…, orderId, saleOrderId, saleReferenceId) — the
  // order id appears twice, once as the original and once as the sale's.
  let verifyXml: string;
  try {
    verifyXml = await postSoap(
      SERVICE_URL,
      '',
      mellatRequestXml('bpVerifyRequest', [
        ...auth,
        `<orderId>${xmlEscape(ctx.providerId)}</orderId>`,
        `<saleOrderId>${xmlEscape(saleOrderId)}</saleOrderId>`,
        `<saleReferenceId>${xmlEscape(saleReferenceId)}</saleReferenceId>`,
      ])
    );
  } catch (error) {
    return {
      ok: false,
      error: 'ارتباط با درگاه ملت برای تأیید تراکنش برقرار نشد.',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  const verifyResult = (soapTag(verifyXml, 'return') ?? '').trim();
  if (verifyResult !== '0' && verifyResult !== '43') {
    return { ok: false, error: `تأیید پرداخت ملت ناموفق بود (کد ${verifyResult || '?'}).` };
  }

  // Settle — a failure here (e.g. 45 = already settled) must not undo a
  // verified payment, so the result is only logged, never fatal.
  try {
    await postSoap(
      SERVICE_URL,
      '',
      mellatRequestXml('bpSettleRequest', [
        ...auth,
        `<orderId>${xmlEscape(ctx.providerId)}</orderId>`,
        `<saleOrderId>${xmlEscape(saleOrderId)}</saleOrderId>`,
        `<saleReferenceId>${xmlEscape(saleReferenceId)}</saleReferenceId>`,
      ])
    );
  } catch {
    // Best effort — the verify above already settled the outcome.
  }

  return { ok: true, refId: saleReferenceId };
}
