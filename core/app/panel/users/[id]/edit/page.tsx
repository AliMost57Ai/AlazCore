import { Breadcrumbs, Anchor, Card, Text } from '@mantine/core';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { listCoreRoles } from '@/lib/core-roles';
import CoreUserForm from '../../CoreUserForm';

export const metadata = { title: 'ویرایش کاربر' };

type PageProps = { params: Promise<{ id: string }> };

/** صفحه اختصاصی ویرایش کاربر پنل Core — به‌جای مودال (فرم بیش از ۴ فیلد). */
export default async function EditCoreUserPage({ params }: PageProps) {
  await requireSession();
  const { id } = await params;

  const user = await prisma.coreUser.findUnique({ where: { id } });
  if (!user) {
    notFound();
  }

  const roles = await listCoreRoles();

  return (
    <>
      <Breadcrumbs mb="sm">
        <Anchor href="/panel/users" size="sm">
          کاربران پنل Core
        </Anchor>
        <Text size="sm" c="dimmed">
          {user.name}
        </Text>
      </Breadcrumbs>
      <Card padding="lg" withBorder>
        <CoreUserForm
          roles={roles}
          initial={{
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
          }}
        />
      </Card>
    </>
  );
}
