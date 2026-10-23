import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAdmin } from '@/lib/api-auth';
import { deleteAdminUser, updateAdminUser } from '@/lib/users-admin';

interface UserBody {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  role?: unknown;
  /** Null/absent/empty = keep the current password. */
  password?: unknown;
}

function toIdentifier(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** PATCH /api/admin/users/[id] — edit a user (admin only). */
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

  if (name === '' || role === '') {
    return NextResponse.json({ error: 'نام و نقش کاربر لازم است.' }, { status: 400 });
  }

  const result = await updateAdminUser(id, session.sub, {
    name,
    email: toIdentifier(body.email),
    phone: toIdentifier(body.phone),
    role,
    password,
  });
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
  const result = await deleteAdminUser(id, session.sub);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
