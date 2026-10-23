/**
 * Constants shared by client and server code.
 *
 * Kept separate from `session.ts` so client components can read cookie names
 * without pulling the signing logic (and its `process.env.AUTH_SECRET` lookup)
 * into the browser bundle.
 */

export const SESSION_COOKIE = 'mnt_session';
export const DIRECTION_COOKIE = 'mnt_dir';

/**
 * شناسه مهمانِ پشتیبانی — توکن opaque داخل این کوکی روی SupportTicket.guestToken
 * می‌نشیند تا تیکت‌های بدون حساب به بازدید بعدی همان مهمان وصل شوند.
 * نامش در این فایل خالص است تا کلاینت هم بخواند.
 */
export const SUPPORT_COOKIE = 'mnt_support';

/** ۳۰ روز به ثانیه — عمر توکن قابلیت مهمان. */
export const SUPPORT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** 7 days, in seconds. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/** Session lifetime when "remember me" is off. */
export const SHORT_SESSION_MAX_AGE = 60 * 60 * 8;

/**
 * How long a login SMS code stays valid, in seconds. Shared by the server
 * (lib/login-method.ts TTL) and the client countdown (OtpCodeStep).
 */
export const LOGIN_CODE_TTL_SECONDS = 120;

export type Direction = 'ltr' | 'rtl';

/** Tipax delivery promise, shown at checkout and quoted in the payment SMS. */
export const TIPAX_NOTE = 'حداقل تحویل ۳ روز بعد از پرداخت سفارش';

/** Credentials surfaced on the login screen so the template is usable as-is.
 *  Lives here (pure module) so the client login form can import it without
 *  pulling lib/users (server-only) into the client bundle. */
export const DEMO_CREDENTIALS = {
  email: 'admin@mantine.dev',
  password: 'admin1234',
} as const;
