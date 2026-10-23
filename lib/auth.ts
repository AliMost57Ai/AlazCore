/**
 * Server-side session access. Import only from server components, route
 * handlers, and server actions — never from a `'use client'` file.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DIRECTION_COOKIE, SESSION_COOKIE, type Direction } from './constants';
import type { MenuAction } from './nav-permissions';
import { sessionCanAccess, verifySession, type SessionPayload } from './session';
import { ensureSiteContext } from './site-context';

export type { Direction };

/** Returns the verified session, or `null` when the visitor is signed out. */
export async function getSession(): Promise<SessionPayload | null> {
  // کانتکست سایت (multi-tenant DB) قبل از هر دسترسی به داده نشسته می‌شود.
  await ensureSiteContext();
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/**
 * Verified guard for protected pages. Middleware already redirects signed-out
 * traffic, but that check is optimistic (it never re-reads the user record), so
 * every protected layout calls this too. Defence in depth: a page must not be
 * renderable purely because a cookie was present.
 */
export async function requireSession(redirectTo = '/dashboard'): Promise<SessionPayload> {
  const session = await getSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(redirectTo)}`);
  }

  return session;
}

/**
 * Whether this session may exercise `action` on `menu` — a grantable
 * admin-menu href from lib/nav-permissions.ts ('view' to open the page,
 * 'edit'/'add' for its write operations). Admins pass everywhere; staff are
 * bound to the permission list signed into their session (their role's
 * grants).
 */
export function canAccessMenu(
  session: SessionPayload,
  menu: string,
  action: MenuAction = 'view'
): boolean {
  return sessionCanAccess(session, menu, action);
}

/**
 * Whether this session may open a customer FILE (/customers/[id]) — holders of
 * '/customers' (the list, with its controls) or the standalone
 * '/customers/file' token (the supporter case: file without the list). Mirrors
 * the ALTERNATE_GRANTS entry that proxy.ts applies — keep the two in step.
 */
export function canAccessCustomerFile(session: SessionPayload): boolean {
  return canAccessMenu(session, '/customers') || canAccessMenu(session, '/customers/file');
}

/** Reads the persisted layout direction, defaulting to RTL. */
export async function getDirection(): Promise<Direction> {
  const store = await cookies();
  return store.get(DIRECTION_COOKIE)?.value === 'ltr' ? 'ltr' : 'rtl';
}
