import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import MetaTagsManager from '@/components/settings/MetaTagsManager';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { listMetaTags } from '@/lib/meta-tags';

export const metadata: Metadata = {
  title: 'تنظیمات — کدهای متا',
};

export const dynamic = 'force-dynamic';

/** Admin-only: third-party meta-code slots (analytics, verification…). */
export default async function MetaSettingsPage() {
  const session = await requireSession('/settings/meta');

  if (!canAccessMenu(session, '/settings/meta')) {
    redirect('/settings');
  }

  const tags = await listMetaTags();
  const canEdit = canAccessMenu(session, '/settings/meta', 'edit');

  return (
    <Stack gap="lg">
      <PageHeader
        title="کدهای متا"
        description="کدهای تحلیل و تاییدیه سوم‌شخص — با اعتبارسنجی سخت‌گیرانه برای جلوگیری از درج کد مخرب."
      />
      <MetaTagsManager initial={tags} canEdit={canEdit} />
    </Stack>
  );
}
