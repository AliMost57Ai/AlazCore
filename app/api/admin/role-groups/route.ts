import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAdmin } from '@/lib/api-auth';
import { createRoleGroup, listRoleGroups } from '@/lib/roles';
import { logSystemEvent } from '@/lib/system-logs';

interface GroupBody {
  name?: unknown;
  description?: unknown;
}

/** GET /api/admin/role-groups — the role-group list (admin only). */
export async function GET() {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  return NextResponse.json({ groups: await listRoleGroups() });
}

/** POST /api/admin/role-groups — create a role group (admin only). */
export async function POST(request: NextRequest) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: GroupBody;
  try {
    body = (await request.json()) as GroupBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const result = await createRoleGroup({
    name: typeof body.name === 'string' ? body.name : '',
    description: typeof body.description === 'string' ? body.description : '',
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  await logSystemEvent({
    kind: 'access',
    provider: 'role-groups',
    action: 'create',
    message: `گروه نقش «${typeof body.name === 'string' ? body.name.trim() : ''}» ایجاد شد.`,
    actorName: session.name,
  });
  return NextResponse.json({ id: result.id }, { status: 201 });
}
