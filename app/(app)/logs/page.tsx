import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import SystemLogsTable from '@/components/settings/SystemLogsTable';
import ListActions from '@/components/ui/panel/ListActions';
import { requireSession } from '@/lib/auth';
import { enNumber } from '@/lib/format';
import { listSystemLogs } from '@/lib/system-logs';
import type { SystemLogKind } from '@/lib/system-log-defs';

export const metadata: Metadata = {
  title: 'لاگ‌های سیستمی',
};

const KINDS: SystemLogKind[] = ['gateway', 'sms', 'shahkar', 'access', 'order'];

function isKind(value: string | undefined): value is SystemLogKind {
  return KINDS.includes(value as SystemLogKind);
}

/**
 * Admin-only: the system-log viewer — gateway and SMS-panel failures with
 * their date, time, and the error the target API actually returned (the
 * expandable "پاسخ API مقصد" row of each entry). فیلتر نوع با فرم GET واحد
 * پنل سفر می‌کند و خروجی اکسل روی همان فیلتر اعمال می‌شود.
 */
export default async function SystemLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const session = await requireSession('/logs');

  if (session.role !== 'admin') {
    redirect('/dashboard');
  }

  const { kind } = await searchParams;
  const activeKind = isKind(kind) ? kind : 'all';
  const logs = await listSystemLogs(activeKind === 'all' ? undefined : activeKind);

  return (
    <Stack gap="lg">
      <PageHeader
        title="لاگ‌های سیستمی"
        description={`${enNumber(logs.length)} رویداد — خطاهای درگاه/پیامک/شاهکار با علت از API مقصد، و تغییرات دسترسی و سفارش‌ها با «توسط»`}
        actions={
          <ListActions
            exportHref={`/api/export/logs${activeKind === 'all' ? '' : `?kind=${activeKind}`}`}
          />
        }
      />
      <Card>
        <SystemLogsTable logs={logs} activeKind={activeKind} />
      </Card>
    </Stack>
  );
}
