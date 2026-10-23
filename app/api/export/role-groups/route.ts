import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { canAccessMenu } from '@/lib/auth';
import { listRoleGroups } from '@/lib/roles';
import { stockListWorkbook } from '@/lib/xlsx-export';

/** Exports the role-group list as an .xlsx file — the /role-groups list. */
export async function GET() {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canAccessMenu(session, '/role-groups')) {
    return NextResponse.json({ error: 'دسترسی به این لیست را ندارید.' }, { status: 403 });
  }

  const groups = await listRoleGroups();
  const rows = groups.map((group) => [group.name, group.description, group.roleCount]);

  const buffer = await stockListWorkbook('گروه نقش‌ها', ['نام گروه', 'توضیح', 'تعداد نقش'], rows);
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="role-groups-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
