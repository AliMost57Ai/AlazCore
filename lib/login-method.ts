/**
 * Sign-in method resolution, shared by the login API, the profile settings and
 * the admin policy. Three methods exist:
 *  - 'password' — the classic identifier + password sign-in,
 *  - 'twostep'  — password first, then a one-time SMS code,
 *  - 'otp'      — phone + one-time SMS code, no password at all.
 *
 * Who picks which: the admin's site-wide policy (تنظیمات → امنیت سامانه —
 * AppSettings.loginPolicy) can force 'twostep' or 'otp' on every account; when
 * the policy is 'password' (or unset) each customer chooses their own method
 * in their storefront profile (/account), and the UI disables that choice
 * while a policy is forced.
 */

import { LOGIN_CODE_TTL_SECONDS } from './constants';
import prisma from './db';
import { getAppSettings } from './settings';
import { sha256Hex, timingSafeEqual } from './users';

export type LoginMethod = 'password' | 'twostep' | 'otp';

export const LOGIN_METHOD_LABELS: Record<LoginMethod, string> = {
  password: 'فقط گذرواژه',
  twostep: 'گذرواژه + کد یکبار مصرف (دو مرحله‌ای)',
  otp: 'فقط کد یکبار مصرف پیامکی',
};

function toMethod(value: string | null | undefined): LoginMethod {
  return value === 'twostep' || value === 'otp' ? value : 'password';
}

/** True when the admin policy forces two-step/OTP on everyone. */
export function isLoginMethodForced(policy: string): boolean {
  return policy === 'twostep' || policy === 'otp';
}

/**
 * The sign-in method that actually applies to one account: a forced policy
 * wins; otherwise the user's own profile choice (default: password).
 */
export function resolveLoginMethod(userMethod: string, policy: string): LoginMethod {
  if (isLoginMethodForced(policy)) {
    return policy as LoginMethod;
  }
  return toMethod(userMethod);
}

/** The one-time login code lives for 2 minutes (the client shows a countdown). */
export const LOGIN_CODE_TTL_MS = LOGIN_CODE_TTL_SECONDS * 1000;
const CODE_PATTERN = /^\d{6}$/;

export interface PendingLogin {
  userId: string;
  /** Random opaque handle the client presents at the verify step. */
  ticket: string;
  code: string;
}

/**
 * Issues a one-time login code for the user and stores its salted hash plus
 * the hash of the ticket (the plaintext code is returned to the caller — the
 * API route delivers it by SMS; in development it is also returned inline).
 * Any previous pending code is overwritten.
 */
export async function createLoginCode(user: {
  id: string;
  salt: string;
  phone: string;
}): Promise<PendingLogin> {
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
  const ticket = crypto.randomUUID().replace(/-/g, '');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      loginCodeHash: await sha256Hex(`${code}:${user.salt}`),
      loginTicketHash: await sha256Hex(`${ticket}:${user.salt}`),
      loginCodeExpiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MS),
    },
  });

  return { userId: user.id, ticket, code };
}

export interface VerifyLoginInput {
  phone: string;
  ticket: string;
  code: string;
}

/**
 * Completes a two-step/OTP sign-in: the ticket proves the SMS step started for
 * this account, the code proves the phone is in hand. Single-use — the pending
 * state is cleared either way. Returns the user id on success.
 */
export async function verifyLoginCode(input: VerifyLoginInput): Promise<string | null> {
  const { phone, ticket, code } = input;
  if (!CODE_PATTERN.test(code) || ticket.length < 16) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user?.loginCodeHash || !user.loginTicketHash || !user.loginCodeExpiresAt) {
    return null;
  }
  if (user.loginCodeExpiresAt.getTime() <= Date.now()) {
    await clearLoginCode(user.id);
    return null;
  }

  const codeOk = timingSafeEqual(await sha256Hex(`${code}:${user.salt}`), user.loginCodeHash);
  const ticketOk = timingSafeEqual(await sha256Hex(`${ticket}:${user.salt}`), user.loginTicketHash);
  if (!codeOk || !ticketOk) {
    return null;
  }

  await clearLoginCode(user.id);
  return user.id;
}

/** Clears any pending login code (used on success, expiry and logout paths). */
export async function clearLoginCode(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { loginCodeHash: null, loginTicketHash: null, loginCodeExpiresAt: null },
  });
}

/** The account with this phone, plus the sign-in method that applies to it. */
export async function resolveLoginMethodByPhone(phone: string): Promise<{
  user: { id: string; salt: string; phone: string; name: string };
  method: LoginMethod;
  /** True when the admin blocked the account — no OTP is ever sent. */
  blocked: boolean;
} | null> {
  const [user, settings] = await Promise.all([
    prisma.user.findUnique({ where: { phone } }),
    getAppSettings(),
  ]);
  if (!user) {
    return null;
  }
  return {
    user: { id: user.id, salt: user.salt, phone: user.phone ?? phone, name: user.name },
    method: resolveLoginMethod(user.loginMethod, settings.loginPolicy),
    blocked: user.isBlocked,
  };
}
