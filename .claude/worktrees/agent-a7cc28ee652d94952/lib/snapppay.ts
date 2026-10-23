/**
 * SnappPay BNPL gateway.
 *
 * SnappPay's public guide (academy.snapppay.ir) documents the merchant flow,
 * not raw endpoints: credentials come from portal.snapppay.ir → توسعه فنی →
 * دسترسی‌های فنی (Client ID, Client Secret, Username, Password, Production
 * Base URL), and the technical guide notes regenerated secrets are shown
 * exactly once. The endpoint paths below follow SnappPay's published REST
 * convention; the base URL is admin-configurable so any panel-specific
 * address can be substituted without a code change.
 *
 * Flow (mirrors DigiPay's):
 *  1. POST /apigateway/.../token — Basic auth client_id:client_secret +
 *     password grant (username/password) → Bearer token (~1h, cached).
 *  2. POST payment/token — the payment request (amount, providerId, …)
 *     → payment token / redirect URL.
 *  3. POST verify — settles the purchase after the callback.
 *
 * Amounts are Rial — order amounts here are Toman, so ×10.
 */

const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_BASE_URL = 'https://api.snapppay.ir';

export interface SnapppayRequestInput {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  /** Overrides the default production base URL (from the portal). */
  baseUrl: string;
  /** Order total in Toman. */
  amountToman: number;
  /** Our unique purchase id — the order display id. */
  providerId: string;
  /** Absolute URL SnappPay redirects back to after payment. */
  callbackUrl: string;
  mobile: string;
}

export type SnapppayRequestResult =
  | { ok: true; providerId: string; trackingCode: string; redirectUrl: string }
  | { ok: false; error: string };

export interface SnapppayVerifyInput {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  baseUrl: string;
  trackingCode: string;
  providerId: string;
}

export type SnapppayVerifyResult = { ok: true; providerId: string } | { ok: false; error: string };

function apiBase(baseUrl: string): string {
  const trimmed = baseUrl.trim() !== '' ? baseUrl.trim().replace(/\/+$/, '') : DEFAULT_BASE_URL;
  return `${trimmed}/api`;
}

/** In-memory token cache — the token lasts ~1h, traffic reuses it. */
interface CachedToken {
  token: string;
  expiresAt: number;
}
const tokenCaches = new Map<string, CachedToken>();

async function login(input: {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  baseUrl: string;
}): Promise<string> {
  const cacheKey = `${apiBase(input.baseUrl)}|${input.clientId}`;
  const cached = tokenCaches.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const body = new URLSearchParams({
    grant_type: 'password',
    username: input.username,
    password: input.password,
    scope: 'online_shopping',
  });
  const basic = Buffer.from(`${input.clientId}:${input.clientSecret}`).toString('base64');
  const response = await fetch(`${apiBase(input.baseUrl)}/gateway/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${basic}`,
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
  tokenCaches.set(cacheKey, {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3599) * 1000,
  });
  return payload.access_token;
}

interface SnapppayEnvelope {
  paymentToken?: string;
  redirectUrl?: string;
  successful?: boolean;
  code?: number | string;
  message?: string;
}

async function apiPost(
  path: string,
  token: string,
  body: Record<string, unknown>,
  baseUrl: string
): Promise<SnapppayEnvelope> {
  const response = await fetch(`${apiBase(baseUrl)}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as SnapppayEnvelope;
}

/** Steps 1+2: logs in and opens the BNPL payment request. */
export async function snapppayRequest(input: SnapppayRequestInput): Promise<SnapppayRequestResult> {
  let token: string;
  try {
    token = await login(input);
  } catch {
    return { ok: false, error: 'ورود به درگاه اسنپ‌پی ناموفق بود. اطلاعات پنل را بررسی کنید.' };
  }

  let envelope: SnapppayEnvelope;
  try {
    envelope = await apiPost(
      '/payment/token',
      token,
      {
        amount: input.amountToman * 10,
        mobile: input.mobile,
        providerId: input.providerId,
        callbackUrl: input.callbackUrl,
      },
      input.baseUrl
    );
  } catch {
    return { ok: false, error: 'ارتباط با درگاه اسنپ‌پی برقرار نشد. کمی بعد دوباره تلاش کنید.' };
  }

  const redirectUrl =
    envelope.redirectUrl ??
    (envelope.paymentToken
      ? `${apiBase(input.baseUrl)}/payment?token=${envelope.paymentToken}`
      : undefined);

  if (redirectUrl) {
    return {
      ok: true,
      providerId: input.providerId,
      trackingCode: envelope.paymentToken ?? input.providerId,
      redirectUrl,
    };
  }

  return {
    ok: false,
    error: envelope.message ?? 'ایجاد درخواست پرداخت اسنپ‌پی ناموفق بود.',
  };
}

/** Step 3: verifies a completed BNPL purchase. */
export async function snapppayVerify(input: SnapppayVerifyInput): Promise<SnapppayVerifyResult> {
  let token: string;
  try {
    token = await login(input);
  } catch {
    return { ok: false, error: 'ورود به درگاه اسنپ‌پی برای تأیید تراکنش ناموفق بود.' };
  }

  let envelope: SnapppayEnvelope;
  try {
    envelope = await apiPost(
      '/verify',
      token,
      {
        providerId: input.providerId,
        paymentToken: input.trackingCode,
      },
      input.baseUrl
    );
  } catch {
    return { ok: false, error: 'ارتباط با درگاه اسنپ‌پی برای تأیید تراکنش برقرار نشد.' };
  }

  if (envelope.successful === true) {
    return { ok: true, providerId: input.providerId };
  }

  return {
    ok: false,
    error: envelope.message ?? 'تأیید پرداخت اسنپ‌پی ناموفق بود.',
  };
}
