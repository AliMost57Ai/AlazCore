import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import PickupLocationForm from '@/components/settings/PickupLocationForm';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { isInPersonDeliveryEnabled } from '@/lib/core-license';

export const metadata: Metadata = {
  title: 'نقطه تحویل جدید',
};

/** صفحه اختصاصی ساخت نقطه تحویل حضوری — فرم‌های بیش از ۴ فیلد مودال باز نمی‌شوند. */
export default async function NewPickupLocationPage() {
  const session = await requireSession('/settings/pickup');
  if (!canAccessMenu(session, '/settings/pickup')) {
    redirect('/dashboard');
  }
  if (!(await isInPersonDeliveryEnabled())) {
    redirect('/dashboard');
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title="نقطه تحویل جدید"
        description="نقطه مراجعه مشتری با بازه‌های زمانی و ظرفیت روزانه."
      />
      <Card>
        <PickupLocationForm />
      </Card>
    </Stack>
  );
}
