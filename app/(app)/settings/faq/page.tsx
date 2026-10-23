import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ListActions from '@/components/ui/panel/ListActions';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { listFaqEntries } from '@/lib/faq';
import { enNumber } from '@/lib/format';
import FaqManager from './FaqManager';

export const metadata: Metadata = {
  title: 'سوالات متداول',
};

/** مدیریت سوالات متداول — نمایش عمومی در /faq. */
export default async function FaqSettingsPage() {
  const session = await requireSession('/settings/faq');
  if (!canAccessMenu(session, '/settings/faq')) {
    redirect('/dashboard');
  }

  const entries = await listFaqEntries();
  const canAdd = canAccessMenu(session, '/settings/faq', 'add');
  const canEdit = canAccessMenu(session, '/settings/faq', 'edit');

  return (
    <Stack gap="lg">
      <PageHeader
        title="سوالات متداول"
        description={`${enNumber(entries.length)} سوال — فعال‌ها در صفحه عمومی /faq به همین ترتیب نمایش داده می‌شوند.`}
        actions={<ListActions exportHref="/api/export/faq" />}
      />
      <FaqManager initial={entries} canAdd={canAdd} canEdit={canEdit} />
    </Stack>
  );
}
