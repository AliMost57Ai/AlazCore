import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/constants';
import { isLoginMethodForced } from '@/lib/login-method';
import { signSession } from '@/lib/session';
import { getAppSettings } from '@/lib/settings';
import { updateProfile } from '@/lib/users';

interface AccountBody {
  name?: unknown;
  /** 'password' | 'twostep' | 'otp' — ignored while the admin policy is forced. */
  loginMethod?: unknown;
}

/**
 * Updates the signed-in user's name and sign-in method. The sign-in method is
 * a profile choice — but the admin's site-wide policy (two-step/OTP forced)
 * overrides it, so a request to change it under a forced policy is rejected.
 */
export async function PATCH(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: AccountBody;
  try {
    body = (await request.json()) as AccountBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name : '';
  const settings = await getAppSettings();

  if (typeof body.loginMethod === 'string' && isLoginMethodForced(settings.loginPolicy)) {
    return NextResponse.json(
      { error: 'روش ورود توسط مدیر سایت اجباری شده و قابل تغییر نیست.' },
      { status: 403 }
    );
  }

  const result = await updateProfile(session.sub, {
    name,
    loginMethod: typeof body.loginMethod === 'string' ? body.loginMethod : undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // The session cookie carries the name — re-sign it so the header and menu
  // show the new name without waiting for the next sign-in.
  const token = await signSession(
    {
      sub: session.sub,
      name: result.name,
      email: session.email,
      phone: session.phone,
      role: session.role,
    },
    SESSION_MAX_AGE
  );

  const response = NextResponse.json({ ok: true, name: result.name });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}
