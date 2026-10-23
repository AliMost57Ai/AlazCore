import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@mantine/core';
import RoleGroupsTable from '@/components/admin/RoleGroupsTable';
import PageHeader from '@/components/layout/PageHeader';
import ListActions from '@/components/ui/panel/ListActions';
import { requireSession } from '@/lib/auth';
import { enNumber } from '@/lib/format';
import { listRoleGroups } from '@/lib/roles';

export const metadata: Metadata = {
  title: 'گروه نقش‌ها',
};

/**
 * The admin role-group manager: display-only buckets that organise roles
 * (e.g. «تیم فروش», «انبار»). Groups grant no permissions — they exist so a
 * growing role list stays navigable. Deleting one only ungroups its roles.
 */
export default async function RoleGroupsPage() {
  const session = await requireSession('/role-groups');

  // The API enforces this too; the redirect just avoids dead controls for members.
  if (session.role !== 'admin') {
    redirect('/dashboard');
  }

  const groups = await listRoleGroups();

  return (
    <>
      <PageHeader
        title="گروه نقش‌ها"
        description={`${enNumber(groups.length)} گروه — دسته‌بندی نمایشی نقش‌ها`}
        actions={<ListActions exportHref="/api/export/role-groups" />}
      />
      <Card>
        <RoleGroupsTable groups={groups} />
      </Card>
    </>
  );
}
