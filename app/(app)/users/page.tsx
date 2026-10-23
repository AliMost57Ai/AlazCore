import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@mantine/core';
import UsersTable from '@/components/admin/UsersTable';
import PageHeader from '@/components/layout/PageHeader';
import ListActions from '@/components/ui/panel/ListActions';
import { requireSession } from '@/lib/auth';
import { enNumber } from '@/lib/format';
import { listRoles } from '@/lib/roles';
import { listAdminUsers } from '@/lib/users-admin';

export const metadata: Metadata = {
  title: 'کاربران',
};

/**
 * The admin user manager: every account — staff and customers — in one list,
 * with create/edit (name, login identifier, role, optional password reset)
 * and delete. Guards live server-side: the last admin can't be demoted or
 * deleted, and nobody deletes their own account. جستجو با فرم GET واحد پنل
 * (q) فیلتر می‌شود و خروجی/چاپ روی همان فیلتر اعمال می‌شود.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession('/users');

  // The API enforces this too; the redirect just avoids dead controls for members.
  if (session.role !== 'admin') {
    redirect('/dashboard');
  }

  const { q } = await searchParams;
  const search = q?.trim() || undefined;

  const [users, roles] = await Promise.all([listAdminUsers(), listRoles()]);

  return (
    <>
      <PageHeader
        title="کاربران"
        description={`${enNumber(users.length)} حساب کاربری — کارمندان و مشتریان`}
        actions={<ListActions exportHref="/api/export/users" />}
      />
      <Card>
        <UsersTable users={users} roles={roles} currentUserId={session.sub} search={search ?? ''} />
      </Card>
    </>
  );
}
