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
 * Capability cookie for a guest's support chat — holds the opaque
 * SupportTicket.guestToken their tickets are matched against. Client-safe on
 * purpose (same reason as SESSION_COOKIE): read by the storefront widget.
 */
export const SUPPORT_COOKIE = 'mnt_support';

/** Guest chat identity lifetime — 30 days, in seconds. */
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
