import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAdmin } from '@/lib/auth';
import { deleteCoreRole, updateCoreRole } from '@/lib/core-roles';

/** PATCH /api/roles/[id] — ویرایش نقش (مدیر سامانه). */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiAdmin();
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const result = await updateCoreRole(id, {
    title: typeof body.title === 'string' ? body.title : '',
    isAdmin: body.isAdmin === true,
    permissions: body.permissions ?? [],
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE /api/roles/[id] — حذف نقش (مدیر سامانه؛ نه سیستمی/در حال استفاده). */
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiAdmin();
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const result = await deleteCoreRole(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
