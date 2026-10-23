import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@mantine/core';
import RolesTable from '@/components/admin/RolesTable';
import PageHeader from '@/components/layout/PageHeader';
import ListActions from '@/components/ui/panel/ListActions';
import { requireSession } from '@/lib/auth';
import { currentDomain, getLicense } from '@/lib/core-license';
import { enNumber } from '@/lib/format';
import { ASSIGNABLE_CAPABILITIES, type CapabilityGrant } from '@/lib/nav-permissions';
import { listRoles } from '@/lib/roles';

export const metadata: Metadata = {
  title: 'نقش‌ها',
};

/**
 * The admin role manager: roles carry a Persian title and the دسترسی مدیر
 * flag — a role with that flag grants full admin access to everyone holding
 * it. Renaming a role's machine name re-tags its users in the same
 * transaction, so nobody ends up on an orphaned role string.
 *
 * Capability grants (خالی‌فروشی و…) only surface when the site's Core
 * license enables the feature — the permission chain starts at AlazCore.
 */
export default async function RolesPage() {
  const session = await requireSession('/roles');

  // The API enforces this too; the redirect just avoids dead controls for members.
  if (session.role !== 'admin') {
    redirect('/dashboard');
  }

  const [roles, license] = await Promise.all([listRoles(), getLicense(await currentDomain())]);
  const oversellEnabled = license?.oversell?.allowed === true;
  const capabilities: CapabilityGrant[] = oversellEnabled ? ASSIGNABLE_CAPABILITIES : [];

  return (
    <>
      <PageHeader
        title="نقش‌ها"
        description={`${enNumber(roles.length)} نقش — ${enNumber(roles.filter((role) => role.isAdmin).length)} با دسترسی مدیر`}
        actions={<ListActions exportHref="/api/export/roles" />}
      />
      <Card>
        <RolesTable roles={roles} capabilities={capabilities} />
      </Card>
    </>
  );
}
