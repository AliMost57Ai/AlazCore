import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import SecuritySettings from '@/components/settings/SecuritySettings';
import { requireSession } from '@/lib/auth';
import { getAppSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'تنظیمات — امنیت سامانه',
};

/**
 * Admin-only: the site-wide sign-in policy (password / two-step / code-only).
 * Message templates for the login SMS live on the الگوهای پیامکی page.
 */
export default async function SecuritySettingsPage() {
  const session = await requireSession('/settings/security');

  if (session.role !== 'admin') {
    redirect('/settings');
  }

  const settings = await getAppSettings();

  return (
    <Stack gap="lg">
      <PageHeader
        title="امنیت سامانه"
        description="سیاست ورود سایت — روش ورود مشتریان و اجباری‌کردن ورود دو مرحله‌ای یا رمز یکبار مصرف."
      />
      <SecuritySettings initial={settings} />
    </Stack>
  );
}
