import { NextResponse, type NextRequest } from 'next/server';
import { createLoginCode, resolveLoginMethodByPhone } from '@/lib/login-method';
import { sendLoginOtpSms } from '@/lib/order-sms';
import { ensureSiteContext } from '@/lib/site-context';
import { normalizePhone } from '@/lib/users';

interface OtpBody {
  phone?: unknown;
}

/**
 * Starts an OTP-only sign-in (phone + SMS code, no password). This only works
 * for accounts whose resolved method (profile choice under the admin policy)
 * is 'otp' — for anything else the client is told to use the password form.
 * The response carries the opaque ticket for POST /api/auth/login/verify.
 */
export async function POST(request: NextRequest) {
  await ensureSiteContext();
  let body: OtpBody;
  try {
    body = (await request.json()) as OtpBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const phone = normalizePhone(typeof body.phone === 'string' ? body.phone : '');
  if (!phone) {
    return NextResponse.json(
      { error: 'شماره موبایل باید با ۰۹ شروع شود و دقیقاً ۱۱ رقم باشد.' },
      { status: 400 }
    );
  }

  const resolved = await resolveLoginMethodByPhone(phone);
  if (!resolved) {
    // Registration is public, so duplicate checks already reveal which phones
    // exist — an explicit "not found" is friendlier than a fake success here.
    return NextResponse.json({ error: 'حسابی با این شماره موبایل یافت نشد.' }, { status: 404 });
  }
  if (resolved.method !== 'otp') {
    return NextResponse.json(
      { error: 'برای این حساب، ورود با گذرواژه لازم است.', method: resolved.method },
      { status: 403 }
    );
  }

  const pending = await createLoginCode(resolved.user);
  const sms = await sendLoginOtpSms(phone, pending.code);

  return NextResponse.json({
    ok: true,
    ticket: pending.ticket,
    // Development convenience only — never ship the code in the response.
    ...(process.env.NODE_ENV !== 'production' && !sms.ok
      ? { devCode: pending.code, devNote: sms.error }
      : {}),
  });
}
