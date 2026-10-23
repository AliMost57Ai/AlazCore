import { NextResponse, type NextRequest } from 'next/server';
import { resolveCoreRole, verifyCredentials } from '@/lib/auth';
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from '@/lib/session';

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

/** POST /api/auth/login — ورود کاربر پنل Core (perms نقش در توکن امضا می‌شود). */
export async function POST(request: NextRequest) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'ایمیل و رمز عبور لازم است.' }, { status: 400 });
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: 'ایمیل یا رمز عبور اشتباه است.' }, { status: 401 });
  }

  const resolved = await resolveCoreRole(user.role);
  const token = await signSession({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    perms: resolved?.permissions ?? [],
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
