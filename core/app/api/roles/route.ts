import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAdmin } from '@/lib/auth';
import { createCoreRole, listCoreRoles } from '@/lib/core-roles';

/** GET /api/roles — فهرست نقش‌های پنل Core (مدیر سامانه). */
export async function GET() {
  const session = await requireApiAdmin();
  if (session instanceof Response) {
    return session;
  }
  return NextResponse.json({ roles: await listCoreRoles() });
}

/** POST /api/roles — تعریف نقش جدید (مدیر سامانه). */
export async function POST(request: NextRequest) {
  const session = await requireApiAdmin();
  if (session instanceof Response) {
    return session;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const result = await createCoreRole({
    name: typeof body.name === 'string' ? body.name : '',
    title: typeof body.title === 'string' ? body.title : '',
    isAdmin: body.isAdmin === true,
    permissions: body.permissions ?? [],
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ id: result.id }, { status: 201 });
}
