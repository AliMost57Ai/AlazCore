/**
 * User credentials, backed by Prisma.
 *
 * Passwords are stored as PBKDF2-SHA256 derivations (100k iterations, per-user
 * salt), so the verification path is the shape you want in production — the
 * seed script (prisma/seed.ts) inserts the demo accounts with the same hashes.
 *
 * Two account kinds share this model:
 *  - staff (admin/member) sign in with email + password,
 *  - customers sign up / sign in with an Iranian mobile number (09xxxxxxxxx)
 *    as their username plus a password.
 */

import prisma from './db';
import { fromFaDigits } from './format';
import { getRolePermissions, resolveUserRole } from './roles';
import type { UserRole } from './session';

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;

/** Reset codes are single-use and expire quickly. */
const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const RESET_CODE_PATTERN = /^\d{6}$/;

/** Iranian mobile: starts with 09, exactly 11 digits. */
const PHONE_PATTERN = /^09\d{9}$/;

export interface StoredUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  /** Menu hrefs the role may open (['*'] for admins) — signed into the session. */
  perms: string[];
  salt: string;
  /** PBKDF2-SHA256(password, salt) as lowercase hex. */
  passwordHash: string;
  /** The user's own sign-in method ('password' | 'twostep' | 'otp'). */
  loginMethod: string;
}

/** Credentials surfaced on the login screen so the template is usable as-is. */
export const DEMO_CREDENTIALS = {
  email: 'admin@mantine.dev',
  password: 'admin1234',
} as const;

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Derives the stored hash format for a password. Also useful for seeding users. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH_BITS
  );

  return toHex(bits);
}

/** Length-safe, value-independent comparison of two hex digests. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

function toRole(role: string): UserRole {
  return role === 'admin' ? 'admin' : role === 'customer' ? 'customer' : 'member';
}

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  salt: string;
  passwordHash: string;
  loginMethod: string;
  isBlocked?: boolean;
};

/**
 * Maps a fetched user row to StoredUser. The effective access comes from
 * resolveUserRole (lib/roles.ts): the 'admin' name or any admin-flagged role
 * is full admin access; the role's menu permissions ride along into the
 * session. Passing no override falls back to the built-in names.
 */
async function toStoredUser(user: UserRow, effectiveRole?: UserRole): Promise<StoredUser> {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: effectiveRole ?? toRole(user.role),
    perms: await getRolePermissions(user.role),
    salt: user.salt,
    passwordHash: user.passwordHash,
    loginMethod: user.loginMethod,
  };
}

/**
 * Normalises a phone input: Persian/Arabic digits → ASCII, stray separators
 * removed, then validated against the Iranian mobile format. Returns the clean
 * 11-digit form, or null when it can't be one.
 */
export function normalizePhone(input: string): string | null {
  const digits = fromFaDigits(input).replace(/[\s()-]/g, '');
  return PHONE_PATTERN.test(digits) ? digits : null;
}

/** True when the identifier looks like a phone number rather than an email. */
export function looksLikePhone(identifier: string): boolean {
  return /^0?[۰-۹0-9][\d\s۰-۹٠-٩()-]*$/.test(identifier.trim());
}

/** Sentinel returned when credentials are right but the account is blocked. */
export const BLOCKED_USER = Symbol('blocked-user');

/**
 * Verifies credentials against a fetched user row. Always runs a full PBKDF2
 * derivation — even when the account lookup missed — so response time does not
 * reveal whether an account exists. Blocked accounts (مشتریان → مسدود کردن)
 * are reported as BLOCKED_USER so the route can answer with their own message.
 */
async function verifyAgainstUser(
  user: UserRow | null,
  password: string
): Promise<StoredUser | typeof BLOCKED_USER | null> {
  const salt = user?.salt ?? 'unknown-user-dummy-salt';
  const expected = user?.passwordHash ?? '0'.repeat(64);
  const actual = await hashPassword(password, salt);

  if (!timingSafeEqual(actual, expected) || !user) {
    return null;
  }
  if (user.isBlocked) {
    return BLOCKED_USER;
  }

  // Custom roles resolve their access level and menus through the Role table.
  return toStoredUser(user, await resolveUserRole(user.role));
}

/** Staff sign-in: email + password. */ export async function verifyCredentials(
  email: string,
  password: string
): Promise<StoredUser | typeof BLOCKED_USER | null> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  return verifyAgainstUser(user, password);
}

/** Customer sign-in: phone (09xxxxxxxxx) + password. */
export async function verifyPhoneCredentials(
  phone: string,
  password: string
): Promise<StoredUser | typeof BLOCKED_USER | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { phone: normalized } });
  return verifyAgainstUser(user, password);
}

export interface SignupInput {
  name: string;
  phone: string;
  password: string;
  /** کد ملی — stored when the admin enabled Shahkar matching at signup. */
  nationalId?: string | null;
}

export type SignupResult = { ok: true; user: StoredUser } | { ok: false; error: string };

/**
 * Creates a phone-only customer account. The phone uniqueness is enforced both
 * here (friendly Persian error) and by the DB's unique constraint (race-safe).
 */
export async function signupCustomer(input: SignupInput): Promise<SignupResult> {
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);

  if (name.length < 2) {
    return { ok: false, error: 'نام باید حداقل ۲ نویسه باشد.' };
  }
  if (!phone) {
    return { ok: false, error: 'شماره موبایل باید با ۰۹ شروع شود و دقیقاً ۱۱ رقم باشد.' };
  }
  if (input.password.length < 8) {
    return { ok: false, error: 'گذرواژه باید حداقل ۸ نویسه باشد.' };
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    return { ok: false, error: 'این شماره موبایل قبلاً ثبت شده است. وارد شوید.' };
  }

  const salt = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password, salt);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email: null,
        role: 'customer',
        salt,
        passwordHash,
        ...(input.nationalId ? { nationalId: input.nationalId } : {}),
      },
    });
    return { ok: true, user: await toStoredUser(user) };
  } catch {
    // The unique constraint raced us — same user-facing outcome.
    return { ok: false, error: 'این شماره موبایل قبلاً ثبت شده است. وارد شوید.' };
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return toHex(digest);
}

/** SHA-256 hex of a string — also used by the login-OTP codes (lib/login-method.ts). */
export { sha256Hex };

/**
 * Issues a 6-digit password-reset code for the account holding this phone.
 * Only a salted hash is stored; the plaintext code is returned to the caller
 * (the API route delivers it — by SMS in production, inline in development).
 * Returns null when no account has this phone.
 */
export async function createPasswordResetCode(phone: string): Promise<string | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { phone: normalized } });
  if (!user) {
    return null;
  }

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
  const resetCodeHash = await sha256Hex(`${code}:${user.salt}`);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetCodeHash, resetCodeExpiresAt: new Date(Date.now() + RESET_CODE_TTL_MS) },
  });

  return code;
}

/**
 * Completes a password reset: checks the code hash and expiry, then rehashes
 * the new password with a fresh salt. Single-use — the stored code is cleared
 * either way on success.
 */
export async function resetPasswordWithCode(
  phone: string,
  code: string,
  newPassword: string
): Promise<boolean> {
  const normalized = normalizePhone(phone);
  if (!normalized || !RESET_CODE_PATTERN.test(code) || newPassword.length < 8) {
    return false;
  }

  const user = await prisma.user.findUnique({ where: { phone: normalized } });
  if (!user?.resetCodeHash || !user.resetCodeExpiresAt) {
    return false;
  }
  if (user.resetCodeExpiresAt.getTime() <= Date.now()) {
    // Expired codes are dead — clear them so the row doesn't hold stale state.
    await prisma.user.update({
      where: { id: user.id },
      data: { resetCodeHash: null, resetCodeExpiresAt: null },
    });
    return false;
  }

  const candidate = await sha256Hex(`${code}:${user.salt}`);
  if (!timingSafeEqual(candidate, user.resetCodeHash)) {
    return false;
  }

  const salt = crypto.randomUUID();
  const passwordHash = await hashPassword(newPassword, salt);

  await prisma.user.update({
    where: { id: user.id },
    data: { salt, passwordHash, resetCodeHash: null, resetCodeExpiresAt: null },
  });

  return true;
}

/** Profile fields a signed-in customer may edit. */
export async function updateProfile(
  userId: string,
  input: { name: string; loginMethod?: string }
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const name = input.name.trim();

  if (name.length < 3) {
    return { ok: false, error: 'نام و نام خانوادگی باید حداقل ۳ نویسه باشد.' };
  }
  if (
    input.loginMethod !== undefined &&
    !['password', 'twostep', 'otp'].includes(input.loginMethod)
  ) {
    return { ok: false, error: 'روش ورود نامعتبر است.' };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      ...(input.loginMethod !== undefined ? { loginMethod: input.loginMethod } : {}),
    },
  });
  return { ok: true, name };
}

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

/** Changes the password of the signed-in user, verifying the current one. */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  if (newPassword.length < 8) {
    return { ok: false, error: 'گذرواژه جدید باید حداقل ۸ نویسه باشد.' };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { ok: false, error: 'حساب یافت نشد.' };
  }

  const actual = await hashPassword(currentPassword, user.salt);
  if (!timingSafeEqual(actual, user.passwordHash)) {
    return { ok: false, error: 'گذرواژه فعلی نادرست است.' };
  }

  const salt = crypto.randomUUID();
  const passwordHash = await hashPassword(newPassword, salt);
  await prisma.user.update({ where: { id: userId }, data: { salt, passwordHash } });

  return { ok: true };
}
