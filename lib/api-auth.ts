/**
 * Authorisation helpers for route handlers.
 *
 * proxy.ts skips /api/* entirely, so every API route authenticates itself.
 * `requireApiUser` / `requireApiAdmin` mirror the defence-in-depth pattern of
 * `requireSession` in lib/auth.ts, but return NextResponse objects instead of
 * redirecting (an API caller gets JSON, never a login page).
 */

import { NextResponse } from 'next/server';
import { getSession } from './auth';
import { hasMenuPermission, type MenuAction } from './nav-permissions';
import type { SessionPayload } from './session';

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'برای این عملیات باید وارد شوید.' }, { status: 401 });
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: 'این عملیات فقط برای مدیران مجاز است.' }, { status: 403 });
}

function noMenuAccess(): NextResponse {
  return NextResponse.json(
    { error: 'به این بخش دسترسی ندارید — با مدیر سایت تماس بگیرید.' },
    { status: 403 }
  );
}

/**
 * Returns the session of a signed-in caller, or a 401 response.
 * Usage: `const session = await requireApiUser(); if (session instanceof NextResponse) return session;`
 */
export async function requireApiUser(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  return session ?? unauthorized();
}

/**
 * Returns the session of a signed-in admin, or a 401/403 response.
 * Same usage pattern as `requireApiUser`.
 */
export async function requireApiAdmin(): Promise<SessionPayload | NextResponse> {
  const result = await requireApiUser();
  if (result instanceof NextResponse) {
    return result;
  }
  return result.role === 'admin' ? result : forbidden();
}

/**
 * Returns the session of a caller allowed to work in `menu` (a grantable
 * admin-menu href from lib/nav-permissions.ts — e.g. '/products'), or a
 * 401/403 response. `action` is 'view' by default (read endpoints), 'add'
 * for create endpoints and 'edit' for update/delete ones — pass an array
 * when several actions unlock the endpoint (e.g. image upload serves both
 * creating and editing products). Admins pass for every menu; staff need the
 * matching grant in their role's permission list.
 */
export async function requireApiMenu(
  menu: string,
  action: MenuAction | MenuAction[] = 'view'
): Promise<SessionPayload | NextResponse> {
  const result = await requireApiUser();
  if (result instanceof NextResponse) {
    return result;
  }
  if (result.role === 'admin') {
    return result;
  }
  const actions = Array.isArray(action) ? action : [action];
  const allowed = actions.some((one) => hasMenuPermission(result.perms, menu, one));
  return allowed ? result : noMenuAccess();
}
