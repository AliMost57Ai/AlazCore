import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import SmsTemplates from '@/components/settings/SmsTemplates';
import { requireSession } from '@/lib/auth';
import { getAppSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'تنظیمات — الگوهای پیامکی',
};

/**
 * Admin-only: the SMS template center — the general text templates shared by
 * every panel, and the per-panel pattern/template setups (Mediana patterns,
 * sms.ir verify templates, FarazSMS patterns).
 */
export default async function SmsTemplatesPage() {
  const session = await requireSession('/settings/sms-templates');

  if (session.role !== 'admin') {
    redirect('/settings');
  }

  const settings = await getAppSettings();

  return (
    <Stack gap="lg">
      <PageHeader
        title="الگوهای پیامکی"
        description="قالب‌های متنی پیامک فاکتور و اطلاع‌رسانی ارسال (مشترک بین همه پنل‌ها) و الگوهای اختصاصی هر پنل."
      />
      <SmsTemplates initial={settings} />
    </Stack>
  );
}
