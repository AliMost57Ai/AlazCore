import type { Metadata } from 'next';
import { SimpleGrid, Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import AppearanceSettings from '@/components/settings/AppearanceSettings';
import ProfileSettings, { SessionSettings } from '@/components/settings/ProfileSettings';
import { requireSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'تنظیمات',
};

/**
 * The customer-facing settings page — account + display preferences. The
 * admin settings live under their own sub-pages, all reachable from the
 * تنظیمات group in the sidebar. Staff sign-in is always password-based; the
 * sign-in method choice lives on the storefront (/account) for customers and
 * on the امنیت سامانه page as the site-wide policy.
 */
export default async function SettingsPage() {
  const session = await requireSession('/settings');

  return (
    <Stack gap="lg">
      <PageHeader title="تنظیمات" description="حساب کاربری و ترجیحات نمایش خود را مدیریت کنید." />

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={{ base: 'sm', sm: 'md' }}>
        <ProfileSettings name={session.name} email={session.email ?? session.phone ?? ''} />

        <Stack gap="md">
          <AppearanceSettings />
          <SessionSettings />
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}
