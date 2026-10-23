import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ReturnSettings from '@/components/settings/ReturnSettings';
import { requireSession } from '@/lib/auth';
import { getAppSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'تنظیمات — مرجوعی کالا',
};

/**
 * Admin-only: the return policy (مرجوعی کالا) — feature switch, return window
 * in days from delivery, the default payer of the return shipping cost and
 * the dedicated return-courier option. Per-request overrides happen at the
 * moment of approving each return request (/returns).
 */
export default async function ReturnSettingsPage() {
  const session = await requireSession('/settings/returns');

  if (session.role !== 'admin') {
    redirect('/settings');
  }

  const settings = await getAppSettings();

  return (
    <Stack gap="lg">
      <PageHeader
        title="مرجوعی کالا"
        description="سیاست مرجوعی فروشگاه — مهلت درخواست، پرداخت‌کننده هزینه ارسال برگشت و گزینه پیک مرجوعی."
      />
      <ReturnSettings initial={settings} />
    </Stack>
  );
}
