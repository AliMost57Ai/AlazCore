import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Select, Stack, TextInput } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ReturnsTable from '@/components/returns/ReturnsTable';
import ListActions from '@/components/ui/panel/ListActions';
import ListFilterForm from '@/components/ui/panel/ListFilterForm';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { enNumber } from '@/lib/format';
import { listReturns } from '@/lib/product-returns';
import { RETURN_STATUS_LABELS } from '@/lib/return-status';

export const metadata: Metadata = {
  title: 'مرجوعی کالا',
};

/**
 * لیست درخواست‌های مرجوعی فروشگاه — همان قاعده صفحه سفارش‌ها: فیلتر GET
 * بومی (کد مرجوعی/سفارش/مشتری + وضعیت)، خروجی اکسل با همان فیلترها و
 * جدول PanelList با جزئیات اختصاصی در /returns/[id].
 */
export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await requireSession('/returns');
  if (!canAccessMenu(session, '/returns')) {
    redirect('/dashboard');
  }
  const { q, status } = await searchParams;

  const statusFilter =
    status && status in RETURN_STATUS_LABELS && status !== 'all' ? status : undefined;
  const search = q?.trim() || undefined;
  const rows = await listReturns({ q: search, status: statusFilter });

  const hasFilters = Boolean(search || statusFilter);

  const exportParams = new URLSearchParams();
  if (search) {
    exportParams.set('q', search);
  }
  if (statusFilter) {
    exportParams.set('status', statusFilter);
  }
  const exportHref = `/api/export/returns${
    exportParams.size > 0 ? `?${exportParams.toString()}` : ''
  }`;

  return (
    <Stack gap="lg">
      <PageHeader
        title="مرجوعی کالا"
        description={`${enNumber(rows.length)} درخواست یافت شد`}
        actions={<ListActions exportHref={exportHref} />}
      />

      <Card>
        <ListFilterForm action="/returns" hasFilters={hasFilters}>
          <TextInput
            name="q"
            defaultValue={q ?? ''}
            placeholder="جستجوی کد مرجوعی، شناسه سفارش یا نام مشتری…"
            size="sm"
            radius="md"
            aria-label="جستجوی مرجوعی"
            style={{ flex: '1 1 220px' }}
          />
          <Select
            name="status"
            data={[
              { value: 'all', label: 'همه وضعیت‌ها' },
              ...Object.entries(RETURN_STATUS_LABELS).map(([value, label]) => ({ value, label })),
            ]}
            defaultValue={status ?? 'all'}
            allowDeselect={false}
            size="sm"
            radius="md"
            aria-label="فیلتر وضعیت مرجوعی"
            w={{ base: '100%', xs: 180 }}
          />
        </ListFilterForm>

        <ReturnsTable rows={rows} filtered={hasFilters} />
      </Card>
    </Stack>
  );
}
