import { Breadcrumbs, Anchor, Card, Text } from '@mantine/core';
import { requireSession } from '@/lib/auth';
import { listCoreRoles } from '@/lib/core-roles';
import CoreUserForm from '../CoreUserForm';

export const metadata = { title: 'کاربر جدید' };

/** صفحه اختصاصی ساخت کاربر پنل Core — فرم‌های بیش از ۴ فیلد مودال باز نمی‌شوند. */
export default async function NewCoreUserPage() {
  await requireSession();

  const roles = await listCoreRoles();

  return (
    <>
      <Breadcrumbs mb="sm">
        <Anchor href="/panel/users" size="sm">
          کاربران پنل Core
        </Anchor>
        <Text size="sm" c="dimmed">
          کاربر جدید
        </Text>
      </Breadcrumbs>
      <Card padding="lg" withBorder>
        <CoreUserForm roles={roles} />
      </Card>
    </>
  );
}
