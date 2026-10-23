/**
 * Shahkar identity matching (PGSB) — verifies at signup that a mobile number
 * really belongs to the given national ID code (کد ملی), as the regulator
 * requires. Implemented from the provider's API document (shahkar.pdf):
 *
 *  1. OAuth token:  POST {base}/oauth/token  — Basic auth key + username and
 *     password (form-encoded). Tokens live ~6 minutes; a refresh token is
 *     issued alongside. Both are cached in-memory per process.
 *  2. Match:        POST {base}//api/client/apim/v1/shahkaar/gwsh/serviceIDmatchingencrypted
 *     with the pid / basicAuthorization / Bearer headers. The national ID and
 *     the mobile number are JWE-encrypted with the provider's EC public key
 *     (ECDH-ES + A256KW, A256GCM) before they leave our server.
 *
 * Credentials live in تنظیمات → شاهکار (AppSettings.shahkar*). When the
 * feature is off (shahkarEnabled), signup skips the match entirely.
 */

import { CompactEncrypt, importPKCS8, importSPKI, SignJWT } from 'jose';
import { getAppSettings } from './settings';
import { logSystemError } from './system-logs';

interface CachedToken {
  accessToken: string;
  refreshToken: string;
  /** Absolute epoch ms when the access token stops being trusted. */
  expiresAt: number;
}

/** Process-wide token cache — the API is called at most once per signup. */
let cachedToken: CachedToken | null = null;

const TOKEN_URL = '/oauth/token';
const MATCH_URL = '/api/client/apim/v1/shahkaar/gwsh/serviceIDmatchingencrypted';

/** Iranian national ID: exactly 10 digits. */
const NATIONAL_ID_PATTERN = /^\d{10}$/;

/** A millis timestamp formatted like the doc's requestId (digits only). */
function requestId(): string {
  return String(Date.now());
}

/** Form-encoded POST of the OAuth token endpoint. */
async function tokenRequest(base: string, body: string): Promise<CachedToken> {
  const settings = await getAppSettings();
  const response = await fetch(`${base}${TOKEN_URL}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${settings.shahkarBasicKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;

  if (!response.ok || !payload?.access_token) {
    throw new Error(`گرفتن توکن شاهکار ناموفق بود (HTTP ${response.status}).`);
  }

  // Trust the token slightly less than its stated lifetime.
  const leewayMs = 30_000;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? '',
    expiresAt: Date.now() + Math.max(0, (payload.expires_in ?? 300) * 1000 - leewayMs),
  };
}

/** Gets a fresh-enough access token, refreshing when possible. */
async function getAccessToken(base: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  if (cachedToken?.refreshToken) {
    try {
      cachedToken = await tokenRequest(
        base,
        `grant_type=refresh_token&refresh_token=${encodeURIComponent(cachedToken.refreshToken)}`
      );
      return cachedToken.accessToken;
    } catch {
      // Refresh refused (expired/rotated) — fall through to a fresh password grant.
    }
  }

  const settings = await getAppSettings();
  cachedToken = await tokenRequest(
    base,
    `grant_type=password&username=${encodeURIComponent(settings.shahkarUsername)}&password=${encodeURIComponent(settings.shahkarPassword)}`
  );
  return cachedToken.accessToken;
}

/**
 * JWE-encrypts one payload field exactly like the provider's Java sample: the
 * plaintext rides in the JWT claims as the custom «data» claim, the header
 * sets the ECDH-ES key agreement with A256KW wrapping and A256GCM content
 * encryption, and the key is the provider's EC public key (PEM).
 */
async function encryptField(plaintext: string, publicKeyPem: string): Promise<string> {
  const key = await importSPKI(publicKeyPem, 'ES256');

  return new CompactEncrypt(new TextEncoder().encode(JSON.stringify({ data: plaintext })))
    .setProtectedHeader({ alg: 'ECDH-ES', enc: 'A256GCM', typ: 'JWE' })
    .encrypt(key);
}

export type ShahkarMatchResult = { ok: true } | { ok: false; error: string };

/**
 * Matches a mobile number against a national ID code. Persian errors — they
 * surface directly in the signup form. Network/provider failures are logged
 * to the system log (kind: 'shahkar').
 */
export async function matchShahkar(input: {
  phone: string;
  nationalId: string;
}): Promise<ShahkarMatchResult> {
  const settings = await getAppSettings();

  if (!NATIONAL_ID_PATTERN.test(input.nationalId)) {
    return { ok: false, error: 'کد ملی باید دقیقاً ۱۰ رقم باشد.' };
  }
  if (!settings.shahkarEnabled) {
    return { ok: true };
  }

  const missing =
    !settings.shahkarBasicKey ||
    !settings.shahkarUsername ||
    !settings.shahkarPassword ||
    !settings.shahkarPid ||
    !settings.shahkarBasicAuthKey ||
    !settings.shahkarPublicKeyPem;
  if (missing) {
    return { ok: false, error: 'سرویس شاهکار در تنظیمات کامل پیکربندی نشده است.' };
  }

  const base = settings.shahkarBaseUrl.replace(/\/+$/, '');

  try {
    const token = await getAccessToken(base);
    const [identificationNo, serviceNumber] = await Promise.all([
      encryptField(input.nationalId, settings.shahkarPublicKeyPem),
      encryptField(input.phone, settings.shahkarPublicKeyPem),
    ]);

    const response = await fetch(`${base}${MATCH_URL}`, {
      method: 'POST',
      headers: {
        pid: settings.shahkarPid,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        basicAuthorization: `Basic ${settings.shahkarBasicAuthKey}`,
      },
      body: JSON.stringify({
        serviceType: '*',
        identificationType: '*',
        identificationNo,
        requestId: requestId(),
        serviceNumber,
      }),
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => null)) as {
      result?: {
        data?: { result?: { data?: { result?: string; comment?: string } } };
        status?: { statusCode?: number; message?: string };
      };
      status?: { statusCode?: number; message?: string };
    } | null;

    if (!response.ok || !payload) {
      throw new Error(`سرویس شاهکار پاسخ معتبر نداد (HTTP ${response.status}).`);
    }

    // Success is the nested 200 + «OK.» result of the doc's sample response.
    const inner = payload.result?.data?.result?.data?.result;
    const innerStatus = payload.result?.status?.statusCode;
    if (innerStatus === 200 && inner === 'OK.') {
      return { ok: true };
    }

    // A clean «this pair doesn't match» answer is a user error, not a system one.
    if (innerStatus === 200 && inner && inner !== 'OK.') {
      return {
        ok: false,
        error: 'شماره موبایل با کد ملی مطابقت ندارد. اطلاعات خود را بررسی کنید.',
      };
    }

    throw new Error(
      `پاسخ شاهکار: ${payload.result?.status?.message ?? payload.status?.message ?? 'نامشخص'}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطای ناشناختهٔ سرویس شاهکار.';
    await logSystemError({ kind: 'shahkar', provider: 'shahkar', action: 'match', message });
    return { ok: false, error: 'بررسی اطلاعات با شاهکار در دسترس نیست. کمی بعد دوباره تلاش کنید.' };
  }
}

// --- development/test helpers ----------------------------------------------

/** Clears the cached OAuth token (used by tests and credential rotations). */
export function clearShahkarTokenCache(): void {
  cachedToken = null;
}

/** Signs an arbitrary claim with an EC private key (PEM) — mirrors encryptField's key handling. */
export async function signWithEcKey(
  claims: Record<string, unknown>,
  privatePem: string
): Promise<string> {
  const key = await importPKCS8(privatePem, 'ES256');
  return new SignJWT(claims).setProtectedHeader({ alg: 'ES256' }).sign(key);
}
