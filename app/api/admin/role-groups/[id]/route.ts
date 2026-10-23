import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAdmin } from '@/lib/api-auth';
import { deleteRoleGroup, updateRoleGroup } from '@/lib/roles';
import { logSystemEvent } from '@/lib/system-logs';

interface GroupBody {
  name?: unknown;
  description?: unknown;
}

/** PATCH /api/admin/role-groups/[id] — edit a role group (admin only). */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;

  let body: GroupBody;
  try {
    body = (await request.json()) as GroupBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const result = await updateRoleGroup(id, {
    name: typeof body.name === 'string' ? body.name : '',
    description: typeof body.description === 'string' ? body.description : '',
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  await logSystemEvent({
    kind: 'access',
    provider: 'role-groups',
    action: 'update',
    message: `گروه نقش «${typeof body.name === 'string' ? body.name.trim() : id}» ویرایش شد.`,
    actorName: session.name,
  });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/role-groups/[id] — remove a role group (admin only). */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;
  const result = await deleteRoleGroup(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  await logSystemEvent({
    kind: 'access',
    provider: 'role-groups',
    action: 'delete',
    message: `گروه نقش با شناسه ${id} حذف شد.`,
    actorName: session.name,
  });
  return NextResponse.json({ ok: true });
}
