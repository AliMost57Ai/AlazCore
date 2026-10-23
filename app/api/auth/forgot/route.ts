import { NextResponse, type NextRequest } from 'next/server';
import { ensureSiteContext } from '@/lib/site-context';
import { createPasswordResetCode, normalizePhone } from '@/lib/users';

interface ForgotBody {
  phone?: unknown;
}

/**
 * Step 1 of password recovery: issues a 6-digit code for the account holding
 * this phone. In production the code would go out by SMS — there is no SMS
 * provider in this template, so in development the code is returned inline
 * (and clearly labelled as such in the UI) to keep the flow testable.
 */
export async function POST(request: NextRequest) {
  await ensureSiteContext();
  let body: ForgotBody;

  try {
    body = (await request.json()) as ForgotBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const phone = typeof body.phone === 'string' ? body.phone : '';

  if (!normalizePhone(phone)) {
    return NextResponse.json(
      { error: 'شماره موبایل باید با ۰۹ شروع شود و دقیقاً ۱۱ رقم باشد.' },
      { status: 400 }
    );
  }

  const code = await createPasswordResetCode(phone);

  if (!code) {
    // Registration is public, so duplicate checks already reveal which phones
    // exist — an explicit "not found" is friendlier than a fake success here.
    return NextResponse.json({ error: 'حسابی با این شماره موبایل یافت نشد.' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    // Development convenience only — never ship the code in the response.
    ...(process.env.NODE_ENV !== 'production' ? { devCode: code } : {}),
  });
}
