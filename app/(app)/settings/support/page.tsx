import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import SupportSettings from '@/components/settings/SupportSettings';
import { requireSession } from '@/lib/auth';
import { getAppSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'تنظیمات — پشتیبانی آنلاین',
};

/**
 * فقط ادمین: سوییچ پشتیبانی آنلاین، متن خوش‌آمد و نحوه ورود ویجت چت به صفحه.
 * خاموش کردن پشتیبانی ویجت را از فروشگاه برمی‌دارد و API مشتری/مهمان را
 * می‌بندد؛ لیست تیکت‌های پنل بی‌تاثیر است تا تیکت‌های باز قابل پاسخ بمانند.
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
        title="پشتیبانی آنلاین"
        description="فعال یا غیرفعال کردن گفتگوی پشتیبانی در فروشگاه، متن خوش‌آمد و نحوه نمایش ویجت چت."
      />
      <SupportSettings initial={settings} />
    </Stack>
  );
}
