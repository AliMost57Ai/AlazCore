import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/constants';
import { signSession } from '@/lib/session';
import { getAppSettings } from '@/lib/settings';
import { matchShahkar } from '@/lib/shahkar';
import { ensureSiteContext } from '@/lib/site-context';
import { signupCustomer } from '@/lib/users';

interface SignupBody {
  name?: unknown;
  phone?: unknown;
  password?: unknown;
  /** کد ملی — required when Shahkar matching is enabled. */
  nationalId?: unknown;
}

/**
 * Public customer registration — phone (09xxxxxxxxx) + password, plus the
 * national ID code when the admin enabled Shahkar matching (تنظیمات → شاهکار):
 * the phone↔national-id pair must match at the regulator's service before the
 * account is created. On success the session cookie is set immediately, so
 * signing up also signs you in.
 */
export async function POST(request: NextRequest) {
  await ensureSiteContext();
  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name : '';
  const phone = typeof body.phone === 'string' ? body.phone : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const nationalId = typeof body.nationalId === 'string' ? body.nationalId.trim() : '';

  if (!name || !phone || !password) {
    return NextResponse.json(
      { error: 'نام، شماره موبایل و گذرواژه را وارد کنید.' },
      { status: 400 }
    );
  }

  // Shahkar gate first — no account is created unless the pair matches.
  const settings = await getAppSettings();
  if (settings.shahkarEnabled) {
    if (!nationalId) {
      return NextResponse.json({ error: 'کد ملی را وارد کنید.' }, { status: 400 });
    }
    const match = await matchShahkar({ phone, nationalId });
    if (!match.ok) {
      return NextResponse.json({ error: match.error }, { status: 400 });
    }
  }

  const result = await signupCustomer({ name, phone, password, nationalId: nationalId || null });

  if (!result.ok) {
    // Duplicate phone is the expected client mistake → 409, not 400.
    const status = result.error.includes('قبلاً ثبت شده') ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  const { user } = result;
  const token = await signSession(
    { sub: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    SESSION_MAX_AGE
  );

  const response = NextResponse.json(
    { user: { id: user.id, name: user.name, role: user.role } },
    { status: 201 }
  );

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
