import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { canAccessMenu } from '@/lib/auth';
import { listRoles } from '@/lib/roles';
import { stockListWorkbook } from '@/lib/xlsx-export';

/** Exports the role list as an .xlsx file — the /roles list. */
export async function GET() {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canAccessMenu(session, '/roles')) {
    return NextResponse.json({ error: 'دسترسی به این لیست را ندارید.' }, { status: 403 });
  }

  const roles = await listRoles();
  const rows = roles.map((role) => [
    role.title,
    role.name,
    role.isAdmin ? 'دسترسی کامل' : role.permissions.join('، '),
    role.userCount,
  ]);

  const buffer = await stockListWorkbook(
    'نقش‌ها',
    ['عنوان', 'نام سیستمی', 'دسترسی‌ها', 'تعداد کاربران'],
    rows
  );
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="roles-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
