import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { resetCustomerPassword } from '@/lib/customers';
import { logSystemEvent } from '@/lib/system-logs';

interface ResetBody {
  password?: unknown;
}

/**
 * Admin-side password reset (مشتریان ← بازنشانی رمز عبور): sets a new
 * password for the customer — a fresh salt and hash, same as the customer's
 * own reset flow. The customer keeps their signed-in session on other
 * devices; they will need the new password at the next sign-in.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/customers', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;

  let body: ResetBody;
  try {
    body = (await request.json()) as ResetBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  const result = await resetCustomerPassword(id, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await logSystemEvent({
    kind: 'access',
    provider: 'customers',
    action: 'password_reset',
    message: `گذرواژهٔ مشتری با شناسه ${id} توسط ادمین بازنشانی شد.`,
    actorName: session.name,
  });

  return NextResponse.json({ ok: true });
}
