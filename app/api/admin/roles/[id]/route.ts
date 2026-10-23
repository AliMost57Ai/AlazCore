import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAdmin } from '@/lib/api-auth';
import { deleteRole, updateRole } from '@/lib/roles';
import { logSystemEvent } from '@/lib/system-logs';

interface RoleBody {
  name?: unknown;
  title?: unknown;
  isAdmin?: unknown;
  permissions?: unknown;
}

/** PATCH /api/admin/roles/[id] — edit a role (admin only). */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;

  let body: RoleBody;
  try {
    body = (await request.json()) as RoleBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const result = await updateRole(id, {
    name: typeof body.name === 'string' ? body.name : '',
    title: typeof body.title === 'string' ? body.title : '',
    isAdmin: body.isAdmin === true,
    permissions: body.permissions ?? [],
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await logSystemEvent({
    kind: 'access',
    provider: 'roles',
    action: 'update',
    message: `نقش «${typeof body.title === 'string' && body.title.trim() ? body.title.trim() : id}» ویرایش شد.`,
    actorName: session.name,
    detail: `permissions: ${JSON.stringify(body.permissions ?? [])}${body.isAdmin === true ? ' (مدیر کل)' : ''}`,
  });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/roles/[id] — remove a role (admin only). */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;
  const result = await deleteRole(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await logSystemEvent({
    kind: 'access',
    provider: 'roles',
    action: 'delete',
    message: `نقش با شناسه ${id} حذف شد.`,
    actorName: session.name,
  });
  return NextResponse.json({ ok: true });
}
