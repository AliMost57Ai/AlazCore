import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Select, Stack, Text } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import FinancialSummaryTable, { SummaryTotals } from '@/components/reports/FinancialSummaryTable';
import FaDateField from '@/components/ui/FaDateField';
import ListActions from '@/components/ui/panel/ListActions';
import ListFilterForm from '@/components/ui/panel/ListFilterForm';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { financialSummary, normalizeSummaryFilters } from '@/lib/financial-reports';
import { enCurrency, enNumber } from '@/lib/format';

export const metadata: Metadata = {
  title: 'خلاصه مالی دوره',
};

export const dynamic = 'force-dynamic';

/**
 * گزارش ۱ — خلاصه مالی دوره: فروش لیست، تخفیف‌ها، فروش خالص، وصول‌شده،
 * در انتظار تسویه، کارمزد و خالص مالک — سطر روزانه/ماهانه. همان معناشناسی
 * حسابداری؛ ساختار استاندارد پنل (هدر روشن، فیلتر GET، اکسل + چاپ).
 */
export default async function FinancialSummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession('/reports/summary');
  if (!canAccessMenu(session, '/reports/summary')) {
    redirect('/dashboard');
  }

  const raw = await searchParams;
  const one = (key: string): string | undefined => {
    const value = raw[key];
    return typeof value === 'string' && value ? value : undefined;
  };
  const filters = normalizeSummaryFilters({
    from: one('from'),
    to: one('to'),
    bucket: one('bucket'),
    sales: one('sales'),
    delivery: one('delivery'),
  });

  const { rows, totals, commissionPercent } = await financialSummary(filters);
  const hasFilters =
    Boolean(filters.from || filters.to) ||
    filters.bucket !== 'day' ||
    filters.sales !== 'settled' ||
    filters.delivery !== 'all';

  const exportParams = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (
      value &&
      !(key === 'bucket' && value === 'day') &&
      !(key === 'sales' && value === 'settled') &&
      !(key === 'delivery' && value === 'all')
    ) {
      exportParams.set(key, value);
    }
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title="خلاصه مالی دوره"
        description={`${enNumber(totals.orders)} سفارش — فروش خالص ${enCurrency(
          totals.net,
          false
        )} — خالص مالک ${enCurrency(totals.ownerNet, false)} تومان${
          commissionPercent === null ? ' (درصد پورسانت از بک‌آفیس کور خوانده نشد)' : ''
        }`}
        actions={
          <ListActions
            exportHref={`/api/export/financial-summary${
              exportParams.size > 0 ? `?${exportParams.toString()}` : ''
            }`}
          />
        }
      />

      <Card>
        <ListFilterForm action="/reports/summary" hasFilters={hasFilters}>
          <FaDateField name="from" defaultValue={filters.from ?? ''} label="از تاریخ" />
          <FaDateField name="to" defaultValue={filters.to ?? ''} label="تا تاریخ" />
          <Select
            name="bucket"
            data={[
              { value: 'day', label: 'سطر روزانه' },
              { value: 'month', label: 'سطر ماهانه' },
            ]}
            defaultValue={filters.bucket}
            allowDeselect={false}
            size="sm"
            radius="md"
            aria-label="بازه سطرها"
            w={{ base: '100%', xs: 170 }}
          />
          <Select
            name="sales"
            data={[
              { value: 'settled', label: 'فروش مؤثر' },
              { value: 'all', label: 'همه سفارش‌ها' },
              { value: 'cancelled', label: 'فقط لغوشده' },
            ]}
            defaultValue={filters.sales}
            allowDeselect={false}
            size="sm"
            radius="md"
            aria-label="فیلتر وضعیت فروش"
            w={{ base: '100%', xs: 170 }}
          />
          <Select
            name="delivery"
            data={[
              { value: 'all', label: 'همه روش‌های تحویل' },
              { value: 'pickup', label: 'تحویل حضوری' },
              { value: 'shipping', label: 'ارسالی' },
            ]}
            defaultValue={filters.delivery}
            allowDeselect={false}
            size="sm"
            radius="md"
            aria-label="فیلتر روش تحویل"
            w={{ base: '100%', xs: 190 }}
          />
        </ListFilterForm>

        {rows.length > 0 ? <SummaryTotals totals={totals} /> : null}

        <Text size="xs" c="dimmed" mb={-6}>
          واحد مبالغ: تومان
        </Text>

        <FinancialSummaryTable rows={rows} filtered={hasFilters} />
      </Card>
    </Stack>
  );
}
