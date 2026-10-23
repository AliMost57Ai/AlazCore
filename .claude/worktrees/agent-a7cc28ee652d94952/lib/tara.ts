/**
 * Tara BNPL gateway — a generic two-step "request + verify" driver.
 *
 * Tara (تارا) has no public API documentation; integration details come from
 * the merchant's contract with the provider. This driver therefore makes no
 * endpoint assumptions beyond the conventional shape:
 *
 *  1. POST {requestUrl} — JSON body with the amount, our providerId, the
 *     callback URL and the customer's mobile, authorized by the admin's API
 *     key. The response carries a payment token and a redirect URL.
 *  2. POST {verifyUrl} — JSON body with the token/providerId to settle.
 *
 * Both endpoints and the key are admin-configured (تنظیمات → درگاه پرداخت →
 * تارا), both must be https. Amounts are sent in Rial (order Toman ×10) —
 * the common Iranian gateway convention.
 */

const REQUEST_TIMEOUT_MS = 20_000;

export interface TaraRequestInput {
  apiKey: string;
  requestUrl: string;
  verifyUrl: string;
  amountToman: number;
  /** Our unique purchase id — the order display id. */
  providerId: string;
  callbackUrl: string;
  mobile: string;
}

export type TaraRequestResult =
  | { ok: true; providerId: string; trackingCode: string; redirectUrl: string }
  | { ok: false; error: string };

export interface TaraVerifyInput {
  apiKey: string;
  requestUrl: string;
  verifyUrl: string;
  trackingCode: string;
  providerId: string;
}

export type TaraVerifyResult = { ok: true; providerId: string } | { ok: false; error: string };

/** Accepted shapes for the payment-request response (contract-agnostic). */
interface TaraEnvelope {
  // Conventional Iranian-gateway field names, tried in order.
  token?: string;
  authority?: string;
  paymentToken?: string;
  trackingCode?: string;
  redirectUrl?: string;
  paymentUrl?: string;
  url?: string;
  ok?: boolean;
  success?: boolean;
  error?: string;
  message?: string;
}

async function post(
  url: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<TaraEnvelope> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json().catch(() => ({}))) as TaraEnvelope;
}

/** Step 1: opens the payment request at the contract endpoint. */
export async function taraRequest(input: TaraRequestInput): Promise<TaraRequestResult> {
  let envelope: TaraEnvelope;
  try {
    envelope = await post(input.requestUrl, input.apiKey, {
      amount: input.amountToman * 10,
      providerId: input.providerId,
      callbackUrl: input.callbackUrl,
      mobile: input.mobile,
    });
  } catch {
    return { ok: false, error: 'ارتباط با درگاه تارا برقرار نشد. کمی بعد دوباره تلاش کنید.' };
  }

  const trackingCode =
    envelope.token ?? envelope.authority ?? envelope.paymentToken ?? envelope.trackingCode;
  const redirectUrl = envelope.redirectUrl ?? envelope.paymentUrl ?? envelope.url;

  if (trackingCode && redirectUrl) {
    return {
      ok: true,
      providerId: input.providerId,
      trackingCode,
      redirectUrl,
    };
  }

  return {
    ok: false,
    error: envelope.error ?? envelope.message ?? 'ایجاد درخواست پرداخت تارا ناموفق بود.',
  };
}

/** Step 2: verifies the completed payment. */
export async function taraVerify(input: TaraVerifyInput): Promise<TaraVerifyResult> {
  let envelope: TaraEnvelope;
  try {
    envelope = await post(input.verifyUrl, input.apiKey, {
      providerId: input.providerId,
      trackingCode: input.trackingCode,
      token: input.trackingCode,
      authority: input.trackingCode,
    });
  } catch {
    return { ok: false, error: 'ارتباط با درگاه تارا برای تأیید تراکنش برقرار نشد.' };
  }

  if (envelope.ok === true || envelope.success === true) {
    return { ok: true, providerId: input.providerId };
  }

  return {
    ok: false,
    error: envelope.error ?? envelope.message ?? 'تأیید پرداخت تارا ناموفق بود.',
  };
}
