import { NextResponse, type NextRequest } from 'next/server';
import {
  matchingAdminOnlyHref,
  matchingAlternateGrants,
  matchingAssignableHref,
} from '@/lib/nav-permissions';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

/** Routes reachable while signed out — the shop, auth and pay-link pages. */
const PUBLIC_PATHS = ['/', '/login', '/login-otp', '/signup', '/forgot', '/shop', '/pay'];

/** Auth pages a signed-in visitor has no reason to see again. */
const AUTH_PAGES = ['/login', '/login-otp', '/signup', '/forgot'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  // Signed out, asking for a protected page → send to login, remember where.
  if (!session && !isPublic(pathname)) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${search}`);

    const response = NextResponse.redirect(login);
    // Clear a stale or tampered cookie so we don't loop on the next request.
    if (request.cookies.has(SESSION_COOKIE)) {
      response.cookies.delete(SESSION_COOKIE);
    }
    return response;
  }

  // Signed in, asking for an auth page → nothing to do there. (The shop at
  // `/` and `/shop` stays reachable for signed-in users too — it's storefront,
  // not an auth-only page.)
  if (session && AUTH_PAGES.some((path) => pathname === path)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Menu-level access, enforced centrally: admin-only pages need an admin
  // session, grantable menus need a view grant in the session's permission
  // list (their role's menus — see lib/nav-permissions.ts). Pages outside both
  // catalogs (dashboard, own settings, the shop) stay open to staff.
  // Optimistic like the sign-in check above — pages re-verify with
  // canAccessMenu. Customers never reach here; the app layout sends them back.
  if (session && session.role !== 'customer') {
    const needsAdmin = matchingAdminOnlyHref(pathname) !== null;
    const menu = matchingAssignableHref(pathname);
    // Pages opened by any one of several grants — the customer file, reachable
    // both from the customer list and from inside a support ticket.
    const anyOf = matchingAlternateGrants(pathname);
    if (needsAdmin || menu || anyOf) {
      const perms = session.perms ?? [];
      const allowed =
        session.role === 'admin' ||
        perms.includes('*') ||
        (menu !== null && perms.includes(menu)) ||
        (anyOf !== null && anyOf.some((href) => perms.includes(href)));
      if (!allowed) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Everything except API routes (they authenticate themselves), Next internals,
   * and static files. `/api/auth/login` in particular must stay reachable while
   * signed out.
   */
  matcher: ['/((?!api|_next/static|_next/image|favicon.svg|.*\\.[\\w]+$).*)'],
};
