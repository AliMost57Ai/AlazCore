import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { canAccessMenu } from '@/lib/auth';
import { faJalaliDate } from '@/lib/format';
import { listRoles } from '@/lib/roles';
import { listAdminUsers } from '@/lib/users-admin';
import { stockListWorkbook } from '@/lib/xlsx-export';

/** Exports the staff user list as an .xlsx file — the /users list as-is. */
export async function GET() {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canAccessMenu(session, '/users')) {
    return NextResponse.json({ error: 'دسترسی به این لیست را ندارید.' }, { status: 403 });
  }

  const [users, roles] = await Promise.all([listAdminUsers(), listRoles()]);
  const roleByname = new Map(roles.map((role) => [role.name, role.title]));

  const rows = users.map((user) => [
    user.name,
    user.email ?? user.phone ?? '',
    roleByname.get(user.role) ?? user.role,
    user.walletBalance,
    faJalaliDate(new Date(user.createdAt)),
  ]);

  const buffer = await stockListWorkbook(
    'کاربران',
    ['نام', 'شناسه ورود', 'نقش', 'موجودی کیف پول (تومان)', 'تاریخ عضویت'],
    rows
  );
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="users-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
