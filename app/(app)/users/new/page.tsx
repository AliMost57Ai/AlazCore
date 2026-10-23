import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Stack } from '@mantine/core';
import UserForm from '@/components/admin/UserForm';
import PageHeader from '@/components/layout/PageHeader';
import { requireSession } from '@/lib/auth';
import { listRoles } from '@/lib/roles';

export const metadata: Metadata = {
  title: 'کاربر جدید',
};

/** صفحه اختصاصی ساخت کاربر — فرم‌های بیش از ۴ فیلد مودال باز نمی‌شوند. */
export default async function NewUserPage() {
  const session = await requireSession('/users/new');

  // /users is admin-only — the API enforces it regardless.
  if (session.role !== 'admin') {
    redirect('/dashboard');
  }

  const roles = await listRoles();

  return (
    <Stack gap="lg">
      <PageHeader title="کاربر جدید" description="مشخصات کاربر پرسنلی را وارد کنید." />
      <Card>
        <UserForm roles={roles} />
      </Card>
    </Stack>
  );
}
