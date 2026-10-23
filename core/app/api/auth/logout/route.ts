import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

/** POST /api/auth/logout — خروج از پنل Core. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
