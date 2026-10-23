import type { Metadata } from 'next';
import { Alert, Card, Stack } from '@mantine/core';
import SupportChat from '@/components/support/SupportChat';
import { requireSession } from '@/lib/auth';
import { getAppSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'پشتیبانی',
};

export const dynamic = 'force-dynamic';

/**
 * The customer's support page — the same conversation as the storefront chat
 * widget, on a full page so past tickets are easy to find later.
 */
export default async function AccountSupportPage() {
  const session = await requireSession('/account');
  const settings = await getAppSettings();

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        {settings.supportEnabled ? (
          <SupportChat
            customerName={session.name}
            welcome={settings.supportWelcome}
            height={420}
          />
        ) : (
          <Alert color="gray" title="پشتیبانی آنلاین غیرفعال است">
            در حال حاضر امکان گفتگوی آنلاین وجود ندارد. تیکت‌های قبلی و پاسخ‌های آن‌ها پس از
            فعال‌شدن دوباره در همین صفحه نمایش داده می‌شوند.
          </Alert>
        )}
      </Card>
    </Stack>
  );
}
