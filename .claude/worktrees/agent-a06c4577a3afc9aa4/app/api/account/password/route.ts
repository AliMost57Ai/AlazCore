import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { changePassword } from '@/lib/users';

interface PasswordBody {
  currentPassword?: unknown;
  newPassword?: unknown;
}

/** Changes the signed-in user's password after verifying the current one. */
export async function POST(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: PasswordBody;
  try {
    body = (await request.json()) as PasswordBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'گذرواژه فعلی و گذرواژه جدید را وارد کنید.' },
      { status: 400 }
    );
  }

  const result = await changePassword(session.sub, currentPassword, newPassword);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
