import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import SiteSettingsForm from '@/components/settings/SiteSettingsForm';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { getSiteSettings } from '@/lib/theme-settings';

export const metadata: Metadata = {
  title: 'تنظیمات — مشخصات سایت',
};

export const dynamic = 'force-dynamic';

/** Admin-only: the storefront's identity (name, logo, contact, trust badges). */
export default async function SiteSettingsPage() {
  const session = await requireSession('/settings/site');

  if (!canAccessMenu(session, '/settings/site')) {
    redirect('/settings');
  }

  const settings = await getSiteSettings();
  const canEdit = canAccessMenu(session, '/settings/site', 'edit');

  return (
    <Stack gap="lg">
      <PageHeader
        title="مشخصات سایت"
        description="نام، لوگو، اطلاعات تماس و نشان‌های اعتماد فروشگاه (تنظیمات ← مشخصات سایت)."
      />
      <SiteSettingsForm initial={settings} canEdit={canEdit} />
    </Stack>
  );
}
