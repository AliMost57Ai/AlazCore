/**
 * توکن نشست پنل Core — همان ساختار فروشگاه: HMAC-SHA256 روی body base64url.
 * کوکی جدا (core_session) و SECRET جدا (CORE_AUTH_SECRET) تا نشست پنل Core با
 * نشست فروشگاه‌ها هیچ ربطی به هم نداشته باشند.
 */

import { SESSION_COOKIE, SESSION_MAX_AGE } from './constants';

export interface CoreSessionPayload {
  sub: string;
  name: string;
  email: string;
  role: string;
  /**
   * منوهای مجاز نقش (core/lib/nav-permissions.ts) — ['*'] برای نقش‌های
   * admin. اختیاری: توکن‌های قدیمی پیش از این فیلد به «بدون منو» می‌خوانند و
   * نقش‌های isAdmin با effectivePermissions مستثنا می‌شوند.
   */
  perms?: string[];
  /** Unix timestamp in seconds. */
  exp: number;
}

/** مثل فروشگاه: نقش‌های admin همه‌چیز می‌بینند، بقیه محدود به perms خودشان. */
export function effectivePermissions(session: CoreSessionPayload): string[] {
  if (session.perms?.includes('*')) {
    return ['*'];
  }
  return session.perms ?? [];
}

export { SESSION_COOKIE, SESSION_MAX_AGE };

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.CORE_AUTH_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CORE_AUTH_SECRET is missing or shorter than 16 characters.');
  }
  return 'core-dev-only-insecure-secret-change-me';
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getSigningKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSession(
  payload: Omit<CoreSessionPayload, 'exp'>,
  maxAge = SESSION_MAX_AGE
): Promise<string> {
  const full: CoreSessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAge,
  };
  const body = bytesToBase64Url(encoder.encode(JSON.stringify(full)));
  const signature = await crypto.subtle.sign('HMAC', await getSigningKey(), encoder.encode(body));
  return `${body}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifySession(token: string | undefined): Promise<CoreSessionPayload | null> {
  if (!token) {
    return null;
  }
  const separator = token.lastIndexOf('.');
  if (separator <= 0) {
    return null;
  }
  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await getSigningKey(),
      base64UrlToBytes(signature) as unknown as ArrayBuffer,
      encoder.encode(body)
    );
    if (!valid) {
      return null;
    }
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as CoreSessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
