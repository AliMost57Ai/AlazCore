# -*- coding: utf-8 -*-
"""یک‌بار مصرف: ساخت API نقش‌ها + گیت‌کردن APIهای موجود پنل Core."""
import io

BASE = 'D:/AliMost/NextTest/Github/AlazCore-OnlineShop/core/'

ROLES_ROUTE = '''import { NextResponse, type NextRequest } from 'next/server';
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
'''

ROLES_ID_ROUTE = '''import { NextResponse, type NextRequest } from 'next/server';
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
'''

io.open(BASE + 'app/api/roles/route.ts', 'w', encoding='utf-8', newline='\n').write(ROLES_ROUTE)
io.open(BASE + 'app/api/roles/[id]/route.ts', 'w', encoding='utf-8', newline='\n').write(ROLES_ID_ROUTE)
print('roles API written')


def patch(path, subs):
    s = io.open(BASE + path, encoding='utf-8').read()
    for a, b in subs:
        if a not in s:
            raise AssertionError((path, a[:70]))
        s = s.replace(a, b)
    io.open(BASE + path, 'w', encoding='utf-8', newline='\n').write(s)
    print('patched', path)


GATE_VIEW = "  const session = await requireApiMenu('{menu}');\n  if (session instanceof Response) {{\n    return session;\n  }}"
OLD_GET = "  const session = await requireApiSession();\n  if (session instanceof Response) {{\n    return session;\n  }}"
OLD_MUT = "  const session = await requireApiSuperadmin();\n  if (session instanceof Response) {{\n    return session;\n  }}"

patch('app/api/domains/route.ts', [
    ("import { requireApiSession, requireApiSuperadmin } from '@/lib/auth';",
     "import { requireApiMenu } from '@/lib/auth';"),
    (OLD_GET.format(menu='/panel/domains'),
     GATE_VIEW.format(menu='/panel/domains')),
    (OLD_MUT, GATE_VIEW.format(menu='__ADD__').replace(
        "requireApiMenu('__ADD__')", "requireApiMenu('/panel/domains', 'add')")),
])

patch('app/api/domains/[id]/route.ts', [
    ("import { requireApiSession, requireApiSuperadmin } from '@/lib/auth';",
     "import { requireApiMenu } from '@/lib/auth';"),
    (OLD_GET.format(menu='x').replace("requireApiMenu('x')", "requireApiSession()"),
     GATE_VIEW.format(menu='/panel/domains')),
    (OLD_MUT, GATE_VIEW.format(menu='/panel/domains').replace(
        "requireApiMenu('/panel/domains')", "requireApiMenu('/panel/domains', 'edit')")),
])

for name in ['gateways', 'sms']:
    patch('app/api/domains/[id]/{0}/route.ts'.format(name), [
        ("import { requireApiSession, requireApiSuperadmin } from '@/lib/auth';",
         "import { requireApiMenu } from '@/lib/auth';"),
        (OLD_MUT, GATE_VIEW.format(menu='/panel/domains').replace(
            "requireApiMenu('/panel/domains')", "requireApiMenu('/panel/domains', 'edit')")),
        (OLD_GET.format(menu='x').replace("requireApiMenu('x')", "requireApiSession()"),
         GATE_VIEW.format(menu='/panel/domains')),
    ])

patch('app/api/plans/route.ts', [
    ("import { requireApiSession, requireApiSuperadmin } from '@/lib/auth';",
     "import { requireApiMenu } from '@/lib/auth';"),
    (OLD_GET.format(menu='x').replace("requireApiMenu('x')", "requireApiSession()"),
     GATE_VIEW.format(menu='/panel/plans')),
    (OLD_MUT, GATE_VIEW.format(menu='__ADD__').replace(
        "requireApiMenu('__ADD__')", "requireApiMenu('/panel/plans', 'add')")),
])

patch('app/api/plans/[id]/route.ts', [
    ("import { requireApiSuperadmin } from '@/lib/auth';",
     "import { requireApiMenu } from '@/lib/auth';"),
    (OLD_MUT, GATE_VIEW.format(menu='/panel/plans').replace(
        "requireApiMenu('/panel/plans')", "requireApiMenu('/panel/plans', 'edit')")),
])

patch('app/api/templates/route.ts', [
    ("import { requireApiSession, requireApiSuperadmin } from '@/lib/auth';",
     "import { requireApiMenu } from '@/lib/auth';"),
    (OLD_GET.format(menu='x').replace("requireApiMenu('x')", "requireApiSession()"),
     GATE_VIEW.format(menu='/panel/templates')),
    (OLD_MUT, GATE_VIEW.format(menu='__ADD__').replace(
        "requireApiMenu('__ADD__')", "requireApiMenu('/panel/templates', 'add')")),
])

patch('app/api/templates/[id]/route.ts', [
    ("import { requireApiSuperadmin } from '@/lib/auth';",
     "import { requireApiMenu } from '@/lib/auth';"),
    (OLD_MUT, GATE_VIEW.format(menu='/panel/templates').replace(
        "requireApiMenu('/panel/templates')", "requireApiMenu('/panel/templates', 'edit')")),
])

patch('app/api/users/route.ts', [
    ("import { hashPassword, makeSalt, requireApiSession, requireApiSuperadmin } from '@/lib/auth';",
     "import { hashPassword, makeSalt, requireApiAdmin } from '@/lib/auth';"),
    ("const session = await requireApiSuperadmin();", "const session = await requireApiAdmin();"),
])

patch('app/api/users/[id]/route.ts', [
    ("import { hashPassword, makeSalt, requireApiSuperadmin } from '@/lib/auth';",
     "import { hashPassword, makeSalt, requireApiAdmin } from '@/lib/auth';"),
    ("const session = await requireApiSuperadmin();", "const session = await requireApiAdmin();"),
])

patch('app/api/settings/route.ts', [
    ("import { requireApiSuperadmin } from '@/lib/auth';",
     "import { requireApiAdmin } from '@/lib/auth';"),
    ("const session = await requireApiSuperadmin();", "const session = await requireApiAdmin();"),
])

patch('app/api/tickets/route.ts', [
    ("import { requireApiSession } from '@/lib/auth';", "import { requireApiMenu } from '@/lib/auth';"),
    ("const session = await requireApiSession();",
     "const session = await requireApiMenu('/panel/tickets');"),
])

patch('app/api/tickets/[id]/route.ts', [
    ("import { requireApiSession } from '@/lib/auth';", "import { requireApiMenu } from '@/lib/auth';"),
    ("const session = await requireApiSession();",
     "const session = await requireApiMenu('/panel/tickets', 'edit');"),
])

print('ALL PATCHED')
