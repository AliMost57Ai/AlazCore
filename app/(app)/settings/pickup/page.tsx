import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import PickupManager from '@/components/settings/PickupManager';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { isInPersonDeliveryEnabled } from '@/lib/core-license';

export const metadata: Metadata = {
  title: 'مدیریت تحویل حضوری',
};

/**
 * مدیریت تحویل حضوری — نقاط مراجعه (آدرس + موقعیت)، بازه‌های زمانی با ظرفیت
 * و روزهای تعطیل. فیچر خاموش در Core = صفحه در دسترس نیست.
 */
export default async function PickupSettingsPage() {
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
        title="مدیریت تحویل حضوری"
        description="نقاط مراجعه مشتری با آدرس و موقعیت، بازه‌های زمانی تحویل با ظرفیت هر روز و روزهای تعطیل — الگویی که در روش‌های ارسال به‌عنوان «تحویل حضوری» فعال می‌شود."
      />
      <PickupManager />
    </Stack>
  );
}
