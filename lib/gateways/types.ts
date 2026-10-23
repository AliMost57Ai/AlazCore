/**
 * Shared types and HTTP helpers for the payment-gateway drivers
 * (lib/gateways/*). Every driver implements the same two-step shape:
 *
 *  start  — opens a payment request at the gateway and says where the
 *           customer's browser goes next (a plain redirect, or a form-POST
 *           relay page for Saman/Sepah/SizPay).
 *  verify — settles the payment from the callback fields, checking the
 *           gateway's own API.
 *
 * Drivers stay independent of Prisma and of the HTTP routes: they take a
 * context object (settings + amount + ids) and return plain results, exactly
 * like the pre-existing lib/zarinpal.ts / lib/digipay.ts drivers.
 */

import type { AppSettings } from '../settings';

export const REQUEST_TIMEOUT_MS = 20_000;

/** One ordered product line, for BNPL gateways that itemize the purchase. */
export interface GatewayCartItem {
  name: string;
  qty: number;
  /** Unit price in Toman. */
  unitPrice: number;
}

export interface GatewayStartContext {
  settings: AppSettings;
  /** Payable amount in Toman (order − coupon + invoiced shipping). */
  amountToman: number;
  /** The id we show the gateway — echoed back on its callback. */
  providerId: string;
  /** Our absolute callback URL. */
  callbackUrl: string;
  /** Customer mobile (09…), when known. */
  mobile?: string | null;
  /** Human description for the receipt. */
  description?: string;
  /** Ordered cart items — empty for synthesized single-item sends. */
  items: GatewayCartItem[];
}

export type GatewayStartResult =
  | {
      ok: true;
      /** Where the browser goes next — a plain redirect, or… */
      redirectUrl: string;
      /** …a form-POST target (Saman/Sepah/SizPay relay pages). */
      postUrl?: string;
      postFields?: Record<string, string>;
      /** Gateway token, persisted on the transaction for the verify step. */
      token?: string;
      /** The provider id actually sent (drivers with numeric-only order ids
       *  generate their own and report it back). */
      providerId: string;
    }
  | { ok: false; error: string; detail?: string };

export interface GatewayVerifyContext {
  settings: AppSettings;
  /** The transaction amount in Toman — matched against what the gateway reports. */
  amountToman: number;
  /** Our id for the transaction, as sent at start. */
  providerId: string;
  /** Gateway token stored at checkout (null for gateways without one). */
  token: string | null;
  /** Jalali "yyyy/MM/dd" (ASCII digits) of the transaction's creation —
   *  Fakher's status report is scoped by that date. */
  createdJalali: string;
  /** Every callback query/form field, keys lowercased. */
  params: Record<string, string>;
}

export type GatewayVerifyResult =
  | {
      ok: true;
      refId: string;
      amountRial?: number;
      /** شماره کارت ماسک‌شده پرداخت‌کننده، وقتی درگاه در پاسخ verify می‌فرستد. */
      cardPan?: string | null;
      /** سایر اطلاعات تأیید درگاه (کارمزد، نوع کارمزد، …) برای نمایش تراکنش. */
      extra?: Record<string, string>;
    }
  | { ok: false; error: string; detail?: string };

/** Reads the first present key (already lowercased by the caller). */
export function param(params: Record<string, string>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = params[name];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return undefined;
}

/** Persian small Jalali date "yyyy/MM/dd" in ASCII digits. */
export function toJalaliAscii(date: Date): string {
  // The jalaali-js algorithm, as in lib/format.ts (kept local to avoid
  // importing a client-facing module into the server-only gateway layer).
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const daysBeforeMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const div = (a: number, b: number): number => Math.floor(a / b);

  let jy = gy <= 1600 ? 0 : 979;
  const gy2 = gy <= 1600 ? gy - 621 : gy - 1600;
  const gy3 = gm > 2 ? gy2 + 1 : gy2;
  let days =
    365 * gy2 +
    div(gy3 + 3, 4) -
    div(gy3 + 99, 100) +
    div(gy3 + 399, 400) -
    80 +
    gd +
    daysBeforeMonth[gm - 1];

  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }

  const month = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const day = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  const pad2 = (value: number): string => String(value).padStart(2, '0');

  return `${jy}/${pad2(month)}/${pad2(day)}`;
}

/** POSTs JSON and parses a JSON response — throws on transport/HTTP errors.
 *  HTTP errors carry the response body so callers can log what the gateway
 *  actually said (parsed JSON is compacted, anything else is raw text). */
export async function postJson<T>(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Accept: 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await responseText(response)}`);
  }
  return (await response.json()) as T;
}

/** Reads a response body for an error message — JSON is compacted to one line. */
async function responseText(response: Response): Promise<string> {
  try {
    const text = (await response.text()).trim();
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        return JSON.stringify(JSON.parse(text));
      } catch {
        // Fall through to the raw text.
      }
    }
    return text;
  } catch {
    return '';
  }
}

/** POSTs a form-encoded body (OAuth/SOAP-style services) and parses JSON. */
export async function postFormJson<T>(url: string, fields: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await responseText(response)}`);
  }
  return (await response.json()) as T;
}

/** POSTs a SOAP envelope and returns the raw XML response text. */
export async function postSoap(url: string, soapAction: string, xml: string): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'text/xml; charset=utf-8',
  };
  // An empty action (Mellat) is sent as an explicitly empty header — the
  // service dispatches on the body element alone.
  if (soapAction !== '') {
    headers.SOAPAction = soapAction;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: xml,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${(await response.text()).trim().slice(0, 500)}`);
  }
  return await response.text();
}

/** Escapes XML text content. */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Extracts the text of a tag from a SOAP response (first match). */
export function soapTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

/** A SOAP 1.1 envelope wrapping one operation element. */
export function soapEnvelope(innerXml: string): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
    '<soap:Body>',
    innerXml,
    '</soap:Body>',
    '</soap:Envelope>',
  ].join('');
}
