import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Card, Stack } from '@mantine/core';
import UserForm from '@/components/admin/UserForm';
import PageHeader from '@/components/layout/PageHeader';
import { requireSession } from '@/lib/auth';
import { listRoles } from '@/lib/roles';
import { listAdminUsers } from '@/lib/users-admin';

export const metadata: Metadata = {
  title: 'ویرایش کاربر',
};

type PageProps = { params: Promise<{ id: string }> };

/** صفحه اختصاصی ویرایش کاربر — به‌جای مودال (فرم بیش از ۴ فیلد). */
export default async function EditUserPage({ params }: PageProps) {
  const session = await requireSession('/users');

  if (session.role !== 'admin') {
    redirect('/dashboard');
  }

  const { id } = await params;
  const [users, roles] = await Promise.all([listAdminUsers(), listRoles()]);
  const user = users.find((row) => row.id === id);

  if (!user) {
    notFound();
  }

  return (
    <Stack gap="lg">
      <PageHeader title={`ویرایش ${user.name}`} description="تغییرات خود را ذخیره کنید." />
      <Card>
        <UserForm roles={roles} initial={user} />
      </Card>
    </Stack>
  );
}
