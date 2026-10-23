/**
 * Who is on the other end of a support conversation.
 *
 * A support route has three possible callers, and they are told apart here:
 *  1. a signed-in customer (role 'customer') — their own tickets,
 *  2. a signed-in staff member — the panel, gated on the /support menu,
 *  3. a guest — identified by the opaque token in the mnt_support cookie that
 *     was handed out when they gave their name and phone.
 *
 * Server-only: reads cookies and the session. The cookie NAME lives in
 * lib/constants.ts so the client widget can read it without this module.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireApiMenu } from './api-auth';
import { getSession } from './auth';
import { SUPPORT_COOKIE } from './constants';
import type { SessionPayload } from './session';

export { SUPPORT_COOKIE, SUPPORT_COOKIE_MAX_AGE } from './constants';

/** The three kinds of support caller, as the domain layer wants them. */
export type SupportViewer =
  | { kind: 'customer'; userId: string; name: string }
  | { kind: 'guest'; token: string }
  | { kind: 'staff'; session: SessionPayload };

/**
 * Resolves the current support caller, or null when there is none.
 *
 * A staff session with no /support permission resolves to null rather than to
 * a viewer: the storefront widget must not offer a chat box to someone who can
 * only answer tickets from the panel.
 */
export async function resolveSupportViewer(): Promise<SupportViewer | null> {
  const resolved = await resolveStorefrontViewer();
  return resolved.ok ? resolved.viewer : null;
}

/**
 * The storefront chat's view of the caller, where "nobody" is a normal answer.
 *
 * A visitor with no session and no guest cookie is not an error — they simply
 * have no conversations yet — so they resolve to `viewer: null`. A *signed-in*
 * user who is neither a customer nor a support-permitted staffer is a different
 * case and is refused with the panel's own 401/403 response (via
 * requireApiMenu), so such a caller can never be mistaken for a new guest and
 * have a ticket opened in their name.
 */
export async function resolveStorefrontViewer(): Promise<
  { ok: true; viewer: SupportViewer | null } | { ok: false; response: NextResponse }
> {
  const session = await getSession();
  if (session) {
    if (session.role === 'customer') {
      return { ok: true, viewer: { kind: 'customer', userId: session.sub, name: session.name } };
    }
    const perms = session.perms ?? [];
    if (session.role === 'admin' || perms.includes('*') || perms.includes('/support')) {
      return { ok: true, viewer: { kind: 'staff', session } };
    }
    const refusal = await requireApiMenu('/support');
    return refusal instanceof NextResponse
      ? { ok: false, response: refusal }
      : { ok: true, viewer: { kind: 'staff', session } };
  }

  const store = await cookies();
  const token = store.get(SUPPORT_COOKIE)?.value;
  return { ok: true, viewer: token ? { kind: 'guest', token } : null };
}

/** The support caller, or null — the customer/guest half of a route's guard. */
export async function requireSupportViewer(): Promise<SupportViewer | NextResponse> {
  const resolved = await resolveStorefrontViewer();
  if (!resolved.ok) {
    return resolved.response;
  }
  return (
    resolved.viewer ??
    NextResponse.json({ error: 'برای این عملیات باید وارد شوید.' }, { status: 401 })
  );
}

/**
 * A supporter: a staff session holding the /support menu. Admins pass, as
 * everywhere else. Reuses requireApiMenu so the 401/403 messages stay the
 * same as the rest of the panel.
 */
export async function requireStaffSupport(): Promise<SessionPayload | NextResponse> {
  return requireApiMenu('/support');
}

/** Response body for the customer-facing routes while support is switched off. */
export function supportDisabled(): NextResponse {
  return NextResponse.json({ error: 'پشتیبانی آنلاین غیرفعال است.' }, { status: 403 });
}
