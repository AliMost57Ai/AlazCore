import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAdmin } from '@/lib/api-auth';
import { logSystemEvent } from '@/lib/system-logs';
import { createAdminUser, listAdminUsers } from '@/lib/users-admin';

interface UserBody {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  password?: unknown;
  role?: unknown;
}

/** GET /api/admin/users — the full user list (admin only). */
export async function GET(request: NextRequest) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  const search = request.nextUrl.searchParams.get('q') ?? undefined;
  return NextResponse.json({ users: await listAdminUsers(search) });
}

/** POST /api/admin/users — create a staff/customer account (admin only). */
export async function POST(request: NextRequest) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: UserBody;
  try {
    body = (await request.json()) as UserBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name : '';
  const email = typeof body.email === 'string' && body.email.trim() !== '' ? body.email : null;
  const phone = typeof body.phone === 'string' && body.phone.trim() !== '' ? body.phone : null;
  const password = typeof body.password === 'string' ? body.password : '';
  const role = typeof body.role === 'string' ? body.role.trim() : '';

  if (password === '') {
    return NextResponse.json({ error: 'گذرواژه لازم است.' }, { status: 400 });
  }

  const result = await createAdminUser({ name, email, phone, password, role });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  await logSystemEvent({
    kind: 'access',
    provider: 'users',
    action: 'create',
    message: `حساب «${name}» با نقش «${role}» ایجاد شد.`,
    actorName: session.name,
  });
  return NextResponse.json({ id: result.id }, { status: 201 });
}
