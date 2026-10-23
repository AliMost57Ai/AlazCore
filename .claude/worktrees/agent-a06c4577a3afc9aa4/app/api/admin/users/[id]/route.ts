import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAdmin } from '@/lib/api-auth';
import {
  deleteAdminUser,
  getAdminUser,
  getUserActivity,
  setUserBlocked,
  updateAdminUser,
} from '@/lib/users-admin';

interface UserBody {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  role?: unknown;
  /** Null/absent/empty = keep the current password. */
  password?: unknown;
  /** Boolean = block/unblock. Sent on its own by the enable/disable action. */
  blocked?: unknown;
}

function toIdentifier(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * GET /api/admin/users/[id] — one account plus counts of everything it left
 * behind. The delete dialog reads this before offering a delete, so the
 * activity rule is explained before the button, not after the failure.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await params;
  const [user, activity] = await Promise.all([getAdminUser(id), getUserActivity(id)]);
  if (!user || !activity) {
    return NextResponse.json({ error: 'کاربر یافت نشد.' }, { status: 404 });
  }
  return NextResponse.json({ user, activity });
}

/** PATCH /api/admin/users/[id] — edit a user, or just block/unblock it (admin only). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await params;

  let body: UserBody;
  try {
    body = (await request.json()) as UserBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name : '';
  const role = typeof body.role === 'string' ? body.role.trim() : '';
  const password = typeof body.password === 'string' && body.password !== '' ? body.password : null;

  // A body carrying only `blocked` is the enable/disable action — there is no
  // profile to validate, so it takes a separate path from the edit form.
  if (typeof body.blocked === 'boolean' && name === '' && role === '') {
    // Blocking yourself would end your own session's ability to undo it.
    if (body.blocked && id === session.sub) {
      return NextResponse.json(
        { error: 'حساب خودتان را نمی‌توانید غیرفعال کنید.' },
        { status: 400 }
      );
    }
    const result = await setUserBlocked(id, body.blocked, { id: session.sub, name: session.name });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, blocked: body.blocked });
  }

  if (name === '' || role === '') {
    return NextResponse.json({ error: 'نام و نقش کاربر لازم است.' }, { status: 400 });
  }

  const result = await updateAdminUser(
    id,
    { id: session.sub, name: session.name },
    {
      name,
      email: toIdentifier(body.email),
      phone: toIdentifier(body.phone),
      role,
      password,
    }
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/users/[id] — remove a user (admin only). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await params;
  const result = await deleteAdminUser(id, { id: session.sub, name: session.name });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
