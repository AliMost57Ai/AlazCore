import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

/**
 * محافظ سبک مسیرهای پنل Core: بدون نشست → /login. مسیرهای API خودشان
 * احراز می‌شوند (requireApiSession) — اینجا فقط صفحات.
 */
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/validate', '/api/tenant', '/api/catalog'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const login = new URL('/login', request.url);
    if (!pathname.startsWith('/api')) {
      login.searchParams.set('next', `${pathname}${search}`);
    }
    const response = NextResponse.redirect(login);
    if (request.cookies.has(SESSION_COOKIE)) {
      response.cookies.delete(SESSION_COOKIE);
    }
    return response;
  }

  // واردشده که سراغ /login برود جایی ندارد.
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/panel', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.svg|.*\\.[\\w]+$).*)'],
};
