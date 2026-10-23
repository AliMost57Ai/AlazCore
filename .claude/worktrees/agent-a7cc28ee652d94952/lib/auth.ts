/**
 * Server-side session access. Import only from server components, route
 * handlers, and server actions — never from a `'use client'` file.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DIRECTION_COOKIE, SESSION_COOKIE, type Direction } from './constants';
import type { MenuAction } from './nav-permissions';
import {
  effectivePermissions,
  sessionCanAccess,
  verifySession,
  type SessionPayload,
} from './session';

export type { Direction };

/** Returns the verified session, or `null` when the visitor is signed out. */
export async function getSession(): Promise<SessionPayload | null> {
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
 * Whether this session may open a customer's file (/customers/[id]).
 *
 * Wider than canAccessMenu(session, '/customers') on purpose: the file is also
 * opened from inside a support conversation, by a supporter who holds the
 * standalone «مشاهدهٔ پروندهٔ مشتری» grant ('/customers/file') and not the
 * customer list. Mirrors the ALTERNATE_GRANTS entry in lib/nav-permissions.ts
 * that proxy.ts already applies — keep the two in step.
 */
export function canAccessCustomerFile(session: SessionPayload): boolean {
  return canAccessMenu(session, '/customers') || canAccessMenu(session, '/customers/file');
}

/**
 * Whether this session is an administrator — the built-in `admin` role, or any
 * role the admin flagged isAdmin (roles.ts resolves both to the '*' wildcard at
 * sign-in).
 *
 * Deliberately not the same question as canAccessMenu: a menu grant answers
 * "may this person do this job?", administration answers "does this person own
 * the shop?". The dashboard's sales charts, revenue tiles and cross-customer
 * order list belong to the second question, so a staff member holding two or
 * three menus gets their pages without the owner's numbers.
 */
export function hasAdminAccess(session: SessionPayload): boolean {
  return effectivePermissions(session).includes('*');
}

/** Reads the persisted layout direction, defaulting to RTL. */
export async function getDirection(): Promise<Direction> {
  const store = await cookies();
  return store.get(DIRECTION_COOKIE)?.value === 'ltr' ? 'ltr' : 'rtl';
}
