import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import SmsSettings from '@/components/settings/SmsSettings';
import { requireSession } from '@/lib/auth';
import { getOwnerAllowedCatalog } from '@/lib/owner-catalog';
import { getAppSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'تنظیمات — پنل پیامک',
};

/**
 * Admin-only: the SMS panel credentials (Mediana, sms.ir, Melipayamak,
 * FarazSMS, Payam-Resan) and the active-panel selection. Message templates
 * live on the الگوهای پیامکی page.
 */
export default async function SmsSettingsPage() {
  const session = await requireSession('/settings/sms');

  if (session.role !== 'admin') {
    redirect('/settings');
  }

  const [settings, rawCatalog] = await Promise.all([getAppSettings(), getOwnerAllowedCatalog()]);
  const catalog = rawCatalog ?? { themes: null, ipg: null, bnpl: null, sms: null };

  return (
    <Stack gap="lg">
      <PageHeader
        title="پنل پیامکی"
        description="تنظیمات پنل‌های پیامک — مدیانا، sms.ir، ملی‌پیامک، فراز اس‌ام‌اس و پیام رسان — و انتخاب پنل فعال. متن پیامک‌ها و الگوهای هر پنل در صفحه «الگوهای پیامکی» تنظیم می‌شوند."
      />
      <SmsSettings initial={settings} allowedPanels={catalog.sms} />
    </Stack>
  );
}
