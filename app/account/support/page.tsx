import type { Metadata } from 'next';
import { IconHeadsetOff } from '@tabler/icons-react';
import { Alert, Anchor, Breadcrumbs, Text } from '@mantine/core';
import SupportChat from '@/components/support/SupportChat';
import { requireSession } from '@/lib/auth';
import { getAppSettings } from '@/lib/settings';
import { DEFAULT_SUPPORT_WELCOME } from '@/lib/support-widget';

export const metadata: Metadata = { title: 'پشتیبانی فروشگاه' };

/**
 * گفتگوی پشتیبانی مشتری با مالک فروشگاه — همان SupportChat ویجت فروشگاه با
 * ارتفاع کامل. پشتیبانی خاموش = هشدار به‌جای چت؛ تیکت‌های باز همچنان از پنل
 * قابل پاسخ‌اند.
 */
export default async function AccountSupportPage() {
  const session = await requireSession('/account/support');
  const settings = await getAppSettings();
  const welcome = settings.supportWelcome.trim() || DEFAULT_SUPPORT_WELCOME;

  return (
    <>
      <Breadcrumbs mb="sm">
        <Anchor href="/" size="sm">
          فروشگاه
        </Anchor>
        <Text size="sm" c="dimmed">
          پشتیبانی
        </Text>
      </Breadcrumbs>
      {settings.supportEnabled ? (
        <SupportChat customerName={session.name} welcome={welcome} height={420} />
      ) : (
        <Alert color="gray" icon={<IconHeadsetOff size={18} />} title="پشتیبانی آنلاین غیرفعال است">
          <Text size="sm">
            گفتگوی آنلاین موقتاً خاموش است — تیکت‌های قبلی‌تان محفوظ‌اند و به‌محض فعال شدن دوباره
            همین‌جا در دسترس خواهند بود.
          </Text>
        </Alert>
      )}
    </>
  );
}
