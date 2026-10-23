import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ShahkarSettings from '@/components/settings/ShahkarSettings';
import { requireSession } from '@/lib/auth';
import { getAppSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'تنظیمات — شاهکار',
};

/**
 * Admin-only: the Shahkar (PGSB) identity-matching service credentials. When
 * enabled, customer signup requires the national ID code and matches it
 * against the mobile number at the regulator's service (lib/shahkar.ts).
 */
export default async function ShahkarSettingsPage() {
  const session = await requireSession('/settings/shahkar');

  if (session.role !== 'admin') {
    redirect('/settings');
  }

  const settings = await getAppSettings();

  return (
    <Stack gap="lg">
      <PageHeader
        title="شاهکار"
        description="کلیدهای سرویس تطبیق شماره موبایل و کد ملی (PGSB) — با فعال‌سازی، ثبت‌نام مشتری نیازمند کد ملی و تأیید شاهکار می‌شود."
      />
      <ShahkarSettings initial={settings} />
    </Stack>
  );
}
