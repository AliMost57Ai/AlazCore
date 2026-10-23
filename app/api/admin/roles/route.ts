import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAdmin } from '@/lib/api-auth';
import { createRole, listRoles } from '@/lib/roles';
import { logSystemEvent } from '@/lib/system-logs';

interface RoleBody {
  name?: unknown;
  title?: unknown;
  isAdmin?: unknown;
  permissions?: unknown;
}

function toRoleInput(body: RoleBody) {
  return {
    name: typeof body.name === 'string' ? body.name : '',
    title: typeof body.title === 'string' ? body.title : '',
    isAdmin: body.isAdmin === true,
    permissions: body.permissions ?? [],
  };
}

/** GET /api/admin/roles — the role list with user counts (admin only). */
export async function GET() {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  return NextResponse.json({ roles: await listRoles() });
}

/** POST /api/admin/roles — create a role (admin only). */
export async function POST(request: NextRequest) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: RoleBody;
  try {
    body = (await request.json()) as RoleBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const result = await createRole(toRoleInput(body));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await logSystemEvent({
    kind: 'access',
    provider: 'roles',
    action: 'create',
    message: `نقش «${typeof body.title === 'string' && body.title.trim() ? body.title.trim() : String(body.name ?? '')}» ایجاد شد.`,
    actorName: session.name,
    detail: `permissions: ${JSON.stringify(body.permissions ?? [])}`,
  });
  return NextResponse.json({ id: result.id }, { status: 201 });
}
