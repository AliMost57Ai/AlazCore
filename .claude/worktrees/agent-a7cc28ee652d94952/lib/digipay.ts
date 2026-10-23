/**
 * DigiPay UPG payment gateway (BNPL + IPG + wallet), per
 * https://www.mydigipay.com/developers/docs/upg/
 *
 * Flow:
 *  1. POST oauth/token (form-data, Basic auth of client_id:client_secret)
 *     → access_token (Bearer, ~1h).
 *  2. POST /tickets/business?type=11 with amount, cellNumber, providerId
 *     (our unique purchase id), callbackUrl → { ticket, redirectUrl }.
 *  3. Redirect the customer to redirectUrl. DigiPay POSTs back to the
 *     callbackUrl with trackingCode + providerId + result.
 *  4. POST /purchases/verify with trackingCode + providerId → the verified
 *     purchase (amount, paymentGateway, …). Unverified successes are
 *     auto-refunded, so verification is mandatory.
 *
 * Amounts are in Rial — order amounts here are Toman, so ×10. The staging
 * host (uat.mydigipay.info) is the sandbox.
 */

const REQUEST_TIMEOUT_MS = 20_000;

export interface DigiPayRequestInput {
  /** API username/password from the DigiPay merchant panel. */
  username: string;
  password: string;
  sandbox: boolean;
  /** Order total in Toman. */
  amountToman: number;
  /** Our unique purchase id — the order display id (stable + short). */
  providerId: string;
  /** Absolute URL DigiPay redirects back to after payment. */
  callbackUrl: string;
  /** Customer mobile (required by DigiPay, also on the receipt). */
  mobile: string;
}

export type DigiPayRequestResult =
  | { ok: true; providerId: string; trackingCode: string; redirectUrl: string }
  | { ok: false; error: string };

export interface DigiPayVerifyInput {
  username: string;
  password: string;
  sandbox: boolean;
  trackingCode: string;
  providerId: string;
}

export type DigiPayVerifyResult =
  | { ok: true; providerId: string; amountRial: number }
  | { ok: false; error: string };

function apiBase(sandbox: boolean): string {
  return sandbox
    ? 'https://uat.mydigipay.info/digipay/api'
    : 'https://api.mydigipay.com/digipay/api';
}

/** In-memory token cache — the token lasts ~1h, checkout traffic reuses it. */
interface CachedToken {
  token: string;
  expiresAt: number;
}
let tokenCache: CachedToken | null = null;

async function login(input: {
  username: string;
  password: string;
  sandbox: boolean;
}): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  // DigiPay's OAuth password grant, form-encoded, Basic auth on client pair.
  const body = new URLSearchParams({
    username: input.username,
    password: input.password,
    grant_type: 'password',
  });
  const response = await fetch(`${apiBase(input.sandbox)}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`login HTTP ${response.status}`);
  }
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new Error('no access_token');
  }
  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3599) * 1000,
  };
  return tokenCache.token;
}

interface DigiPayEnvelope {
  ticket?: string;
  redirectUrl?: string;
  trackingCode?: string;
  providerId?: string;
  amount?: number;
  result?: { status?: string; message?: string; level?: unknown };
}

async function apiPost(
  path: string,
  token: string,
  body: Record<string, unknown>,
  sandbox: boolean
): Promise<DigiPayEnvelope> {
  const response = await fetch(`${apiBase(sandbox)}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      Accept: 'application/json',
      Agent: 'WEB',
      'Digipay-Version': '2022-02-02',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as DigiPayEnvelope;
}

/** Step 1+2: logs in and buys a purchase ticket. */
export async function digipayRequest(input: DigiPayRequestInput): Promise<DigiPayRequestResult> {
  let token: string;
  try {
    token = await login(input);
  } catch {
    return { ok: false, error: 'ورود به درگاه دیجی‌پی ناموفق بود. اطلاعات پنل را بررسی کنید.' };
  }

  let envelope: DigiPayEnvelope;
  try {
    envelope = await apiPost(
      '/tickets/business?type=11',
      token,
      {
        amount: input.amountToman * 10,
        cellNumber: input.mobile,
        providerId: input.providerId,
        callbackUrl: input.callbackUrl,
      },
      input.sandbox
    );
  } catch {
    return { ok: false, error: 'ارتباط با درگاه دیجی‌پی برقرار نشد. کمی بعد دوباره تلاش کنید.' };
  }

  if (envelope.ticket && envelope.redirectUrl) {
    return {
      ok: true,
      providerId: input.providerId,
      trackingCode: envelope.ticket,
      redirectUrl: envelope.redirectUrl,
    };
  }

  return {
    ok: false,
    error: envelope.result?.message ?? 'ایجاد درخواست پرداخت دیجی‌پی ناموفق بود.',
  };
}

/** Step 4: verifies a completed purchase. */
export async function digipayVerify(input: DigiPayVerifyInput): Promise<DigiPayVerifyResult> {
  let token: string;
  try {
    token = await login(input);
  } catch {
    return { ok: false, error: 'ورود به درگاه دیجی‌پی برای تأیید تراکنش ناموفق بود.' };
  }

  let envelope: DigiPayEnvelope;
  try {
    envelope = await apiPost(
      '/purchases/verify?type=13',
      token,
      {
        trackingCode: input.trackingCode,
        providerId: input.providerId,
      },
      input.sandbox
    );
  } catch {
    return { ok: false, error: 'ارتباط با درگاه دیجی‌پی برای تأیید تراکنش برقرار نشد.' };
  }

  // The verify response's result.status is the source of truth; SUCCESS with
  // an amount means the money is settled.
  if (envelope.result?.status === 'SUCCESS' && typeof envelope.amount === 'number') {
    return { ok: true, providerId: input.providerId, amountRial: envelope.amount };
  }

  return { ok: false, error: envelope.result?.message ?? 'تأیید پرداخت دیجی‌پی ناموفق بود.' };
}
