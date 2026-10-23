import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_MAX_AGE, SHORT_SESSION_MAX_AGE } from '@/lib/constants';
import {
  createLoginCode,
  resolveLoginMethod,
  resolveLoginMethodByPhone,
  type LoginMethod,
} from '@/lib/login-method';
import { sendLoginOtpSms } from '@/lib/order-sms';
import { signSession } from '@/lib/session';
import { getAppSettings } from '@/lib/settings';
import { ensureSiteContext } from '@/lib/site-context';
import {
  BLOCKED_USER,
  looksLikePhone,
  normalizePhone,
  verifyCredentials,
  verifyPhoneCredentials,
} from '@/lib/users';

/** The shared answer for blocked accounts — no detail about anything else. */
function blocked(): NextResponse {
  return NextResponse.json(
    { error: 'این حساب مسدود شده است. برای پیگیری با پشتیبانی تماس بگیرید.' },
    { status: 403 }
  );
}

interface LoginBody {
  email?: unknown;
  /** Alternative identifier field: a 09xxxxxxxxx phone number. */
  phone?: unknown;
  password?: unknown;
  remember?: unknown;
}

/**
 * Starts a sign-in with identifier + password. The identifier's resolved
 * method (its profile choice under the admin's site-wide policy —
 * lib/login-method.ts) decides what happens:
 *  - 'password' — the session cookie is set here and now;
 *  - 'twostep'  — after the password checks out, a one-time code is sent and
 *    the response carries an opaque ticket (no cookie); the client completes
 *    at POST /api/auth/login/verify;
 *  - 'otp'      — the password is not a factor at all: the code is issued
 *    straight away (whatever password was typed is ignored), so the classic
 *    form degrades gracefully into the code-only flow.
 * Staff (email, no phone) accounts always sign in with their password.
 */
export async function POST(request: NextRequest) {
  await ensureSiteContext();
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email : '';
  const phone = typeof body.phone === 'string' ? body.phone : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email && !phone) {
    return NextResponse.json({ error: 'ایمیل یا شماره موبایل را وارد کنید.' }, { status: 400 });
  }

  // Customers sign in with their phone as the username; staff with email.
  if (phone || looksLikePhone(email)) {
    const normalized = normalizePhone(phone || email);
    if (!normalized) {
      return NextResponse.json(
        { error: 'شماره موبایل باید با ۰۹ شروع شود و دقیقاً ۱۱ رقم باشد.' },
        { status: 400 }
      );
    }

    // Blocked accounts never reach an OTP send.
    const resolved = await resolveLoginMethodByPhone(normalized);
    if (!resolved) {
      return NextResponse.json(
        { error: 'ایمیل/شماره موبایل یا گذرواژه نادرست است.' },
        { status: 401 }
      );
    }
    if (resolved.blocked) {
      return blocked();
    }
    if (resolved.method === 'otp') {
      const pending = await createLoginCode(resolved.user);
      const sms = await sendLoginOtpSms(normalized, pending.code);

      return NextResponse.json({
        otpRequired: true,
        ticket: pending.ticket,
        // Development convenience only — never ship the code in the response.
        ...(process.env.NODE_ENV !== 'production' && !sms.ok
          ? { devCode: pending.code, devNote: sms.error }
          : {}),
      });
    }

    if (!password) {
      return NextResponse.json({ error: 'گذرواژه را وارد کنید.' }, { status: 400 });
    }

    // One message for "no such account" and "wrong password" alike — never
    // confirm which identifiers are registered.
    const user = await verifyPhoneCredentials(normalized, password);
    if (user === BLOCKED_USER) {
      return blocked();
    }
    if (!user) {
      return NextResponse.json(
        { error: 'ایمیل/شماره موبایل یا گذرواژه نادرست است.' },
        { status: 401 }
      );
    }

    const settings = await getAppSettings();
    const method: LoginMethod = resolveLoginMethod(user.loginMethod, settings.loginPolicy);

    if (method !== 'password') {
      const pending = await createLoginCode({
        id: user.id,
        salt: user.salt,
        phone: user.phone ?? normalized,
      });
      const sms = user.phone ? await sendLoginOtpSms(user.phone, pending.code) : null;

      return NextResponse.json({
        otpRequired: true,
        ticket: pending.ticket,
        ...(process.env.NODE_ENV !== 'production' && !sms?.ok
          ? { devCode: pending.code, devNote: sms?.error }
          : {}),
      });
    }

    return finishLogin(user, body.remember === true);
  }

  if (!password) {
    return NextResponse.json({ error: 'گذرواژه را وارد کنید.' }, { status: 400 });
  }

  const user = await verifyCredentials(email, password);
  if (user === BLOCKED_USER) {
    return blocked();
  }
  if (!user) {
    return NextResponse.json(
      { error: 'ایمیل/شماره موبایل یا گذرواژه نادرست است.' },
      { status: 401 }
    );
  }

  // Staff (email) accounts always sign in with their password.
  return finishLogin(user, body.remember === true);
}

/** Sets the session cookie and returns the signed-in user. */
async function finishLogin(
  user: Extract<Awaited<ReturnType<typeof verifyCredentials>>, { id: string }>,
  remember: boolean
) {
  const maxAge = remember ? SESSION_MAX_AGE : SHORT_SESSION_MAX_AGE;
  const token = await signSession(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      perms: user.perms,
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
