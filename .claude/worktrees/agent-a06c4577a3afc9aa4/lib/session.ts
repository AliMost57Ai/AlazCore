/**
 * Stateless session tokens, signed with HMAC-SHA256.
 *
 * Everything here uses Web Crypto and `btoa`/`atob` only, so the same code runs
 * in the Edge runtime (middleware) and in Node (route handlers, server
 * components). Do not import `node:crypto` into this file.
 */

import { SESSION_MAX_AGE } from './constants';
import { hasMenuPermission, type MenuAction } from './nav-permissions';

export {
  DIRECTION_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  SHORT_SESSION_MAX_AGE,
} from './constants';

export type UserRole = 'admin' | 'member' | 'customer';

export interface SessionPayload {
  /** User id. */
  sub: string;
  name: string;
  /** Null for phone-only customer accounts. */
  email: string | null;
  /** Iranian mobile number — the customer's username. Null for staff. */
  phone: string | null;
  role: UserRole;
  /**
   * Menu hrefs this staff account may open (lib/nav-permissions.ts), ['*']
   * for admins. Optional: tokens signed before the field existed (and
   * customer accounts) read as "no panel menus" — admins are exempted via
   * their role in effectivePermissions.
   */
  perms?: string[];
  /** Expiry, as a Unix timestamp in seconds. */
  exp: number;
}

/**
 * The menu reach of a session: admins (and '*' holders) see everything,
 * everyone else is bound to their signed-in permission list. Roles take
 * effect at sign-in, so this is a snapshot — edits require a re-login.
 */
export function effectivePermissions(session: SessionPayload): string[] {
  if (session.role === 'admin') {
    return ['*'];
  }
  return session.perms ?? [];
}

/**
 * True when the session may exercise `action` on `href` (an exact menu href,
 * not a pathname) — 'view' to open the page, 'edit'/'add' for its write
 * operations. See hasMenuPermission for the entry format.
 */
export function sessionCanAccess(
  session: SessionPayload,
  href: string,
  action: MenuAction = 'view'
): boolean {
  return hasMenuPermission(effectivePermissions(session), href, action);
}

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (secret && secret.length >= 16) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_SECRET is missing or shorter than 16 characters. Set it before deploying.'
    );
  }

  // Development fallback so `npm run dev` works on a fresh clone.
  return 'dev-only-insecure-secret-change-me';
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

/** Signs a payload into a `<body>.<signature>` token. */
export async function signSession(
  payload: Omit<SessionPayload, 'exp'>,
  maxAge = SESSION_MAX_AGE
): Promise<string> {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAge,
  };

  const body = bytesToBase64Url(encoder.encode(JSON.stringify(full)));
  const signature = await crypto.subtle.sign('HMAC', await getSigningKey(), encoder.encode(body));

  return `${body}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

/**
 * Verifies signature and expiry. Returns `null` for anything malformed,
 * tampered with, or expired — never throws on bad input.
 */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
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
    // subtle.verify is constant-time, so this is not a timing oracle.
    const valid = await crypto.subtle.verify(
      'HMAC',
      await getSigningKey(),
      base64UrlToBytes(signature) as unknown as ArrayBuffer,
      encoder.encode(body)
    );

    if (!valid) {
      return null;
    }

    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as SessionPayload;

    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
