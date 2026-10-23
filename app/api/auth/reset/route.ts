import { NextResponse, type NextRequest } from 'next/server';
import { ensureSiteContext } from '@/lib/site-context';
import { normalizePhone, resetPasswordWithCode } from '@/lib/users';

interface ResetBody {
  phone?: unknown;
  code?: unknown;
  password?: unknown;
}

/** Step 2 of password recovery: verify the code, set the new password. */
export async function POST(request: NextRequest) {
  await ensureSiteContext();
  let body: ResetBody;

  try {
    body = (await request.json()) as ResetBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const phone = typeof body.phone === 'string' ? body.phone : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!normalizePhone(phone) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'شماره موبایل یا کد واردشده معتبر نیست.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'گذرواژه باید حداقل ۸ نویسه باشد.' }, { status: 400 });
  }

  const ok = await resetPasswordWithCode(phone, code, password);

  if (!ok) {
    return NextResponse.json(
      { error: 'کد نامعتبر یا منقضی شده است. دوباره درخواست کد بدهید.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
