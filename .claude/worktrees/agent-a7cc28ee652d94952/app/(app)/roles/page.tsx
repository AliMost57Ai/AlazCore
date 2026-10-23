import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@mantine/core';
import RolesTable from '@/components/admin/RolesTable';
import PageHeader from '@/components/layout/PageHeader';
import { requireSession } from '@/lib/auth';
import { faNumber } from '@/lib/format';
import { listRoles } from '@/lib/roles';

export const metadata: Metadata = {
  title: 'نقش‌ها',
};

/**
 * The admin role manager: roles carry a Persian title and the دسترسی مدیر
 * flag — a role with that flag grants full admin access to everyone holding
 * it. Renaming a role's machine name re-tags its users in the same
 * transaction, so nobody ends up on an orphaned role string.
 */
export default async function RolesPage() {
  const session = await requireSession('/roles');

  // The API enforces this too; the redirect just avoids dead controls for members.
  if (session.role !== 'admin') {
    redirect('/dashboard');
  }

  const roles = await listRoles();

  return (
    <>
      <PageHeader
        title="نقش‌ها"
        description={`${faNumber(roles.length)} نقش — ${faNumber(roles.filter((role) => role.isAdmin).length)} با دسترسی مدیر`}
      />
      <Card>
        <RolesTable roles={roles} />
      </Card>
    </>
  );
}
