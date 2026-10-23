import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import SupportSettings from '@/components/settings/SupportSettings';
import { requireSession } from '@/lib/auth';
import { getAppSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'تنظیمات — پشتیبانی',
};

/**
 * Admin-only: the online-support switch and the chat greeting. Turning support
 * off removes the storefront widget and closes the customer/guest support API;
 * the panel's ticket list is unaffected so open tickets stay answerable.
 */
export default async function SupportSettingsPage() {
  const session = await requireSession('/settings/support');

  if (session.role !== 'admin') {
    redirect('/settings');
  }

  const settings = await getAppSettings();

  return (
    <Stack gap="lg">
      <PageHeader
        title="پشتیبانی"
        description="فعال یا غیرفعال کردن گفتگوی پشتیبانی در فروشگاه و متن خوش‌آمد آن."
      />
      <SupportSettings initial={settings} />
    </Stack>
  );
}
