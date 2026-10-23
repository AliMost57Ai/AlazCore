import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_MAX_AGE, SHORT_SESSION_MAX_AGE } from '@/lib/constants';
import prisma from '@/lib/db';
import { verifyLoginCode } from '@/lib/login-method';
import { getRolePermissions, resolveUserRole } from '@/lib/roles';
import { signSession } from '@/lib/session';
import { ensureSiteContext } from '@/lib/site-context';
import { normalizePhone } from '@/lib/users';

interface VerifyBody {
  phone?: unknown;
  ticket?: unknown;
  code?: unknown;
  remember?: unknown;
}

/**
 * Completes a two-step/OTP sign-in started at /api/auth/login (password
 * verified) or /api/auth/login/otp (OTP-only): checks the ticket + the SMS
 * code, then sets the session cookie exactly like a plain login does.
 */
export async function POST(request: NextRequest) {
  await ensureSiteContext();
  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const phone = normalizePhone(typeof body.phone === 'string' ? body.phone : '');
  const ticket = typeof body.ticket === 'string' ? body.ticket : '';
  const code = typeof body.code === 'string' ? body.code : '';

  if (!phone) {
    return NextResponse.json(
      { error: 'شماره موبایل باید با ۰۹ شروع شود و دقیقاً ۱۱ رقم باشد.' },
      { status: 400 }
    );
  }

  const userId = await verifyLoginCode({ phone, ticket, code });
  if (!userId) {
    return NextResponse.json(
      { error: 'کد وارد شده نادرست است یا منقضی شده است.' },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: 'حساب یافت نشد.' }, { status: 404 });
  }
  if (user.isBlocked) {
    return NextResponse.json(
      { error: 'این حساب مسدود شده است. برای پیگیری با پشتیبانی تماس بگیرید.' },
      { status: 403 }
    );
  }

  const maxAge = body.remember === true ? SESSION_MAX_AGE : SHORT_SESSION_MAX_AGE;
  const token = await signSession(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      // A custom role name resolves to its access level and menus via the Role table.
      role: await resolveUserRole(user.role),
      perms: await getRolePermissions(user.role),
    },
    maxAge
  );

  const response = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
  });

  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });

  return response;
}
