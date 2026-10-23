import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Stack, Text } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import CommissionTable from '@/components/reports/CommissionTable';
import FaDateField from '@/components/ui/FaDateField';
import ListActions from '@/components/ui/panel/ListActions';
import ListFilterForm from '@/components/ui/panel/ListFilterForm';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { commissionReport, hasRange } from '@/lib/financial-reports';
import { enCurrency, enNumber } from '@/lib/format';

export const metadata: Metadata = {
  title: 'کارمزد AlazCore',
};

export const dynamic = 'force-dynamic';

/**
 * گزارش ۳ — کارمزد AlazCore: فروش مشمول و پورسانت پلتفرم به تفکیک ماه؛
 * درصد از لایسنس بک‌آفیس کور خوانده می‌شود (همان منبع تسویه).
 */
export default async function CommissionReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession('/reports/commission');
  if (!canAccessMenu(session, '/reports/commission')) {
    redirect('/dashboard');
  }

  const raw = await searchParams;
  const one = (key: string): string | undefined => {
    const value = raw[key];
    return typeof value === 'string' && value ? value : undefined;
  };
  const range = { from: one('from'), to: one('to') };
  const { rows, totals, percent } = await commissionReport(range);
  const hasFilters = hasRange(range);

  const exportParams = new URLSearchParams();
  if (range.from) {
    exportParams.set('from', range.from);
  }
  if (range.to) {
    exportParams.set('to', range.to);
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title="کارمزد AlazCore"
        description={`${enNumber(totals.orders)} سفارش — فروش مشمول ${enCurrency(
          totals.sales,
          false
        )} — کارمزد ${enCurrency(totals.commission, false)} تومان${
          percent !== null ? ` (${enNumber(percent)}٪)` : ''
        }`}
        actions={
          <ListActions
            exportHref={`/api/export/commission${
              exportParams.size > 0 ? `?${exportParams.toString()}` : ''
            }`}
          />
        }
      />

      <Card>
        <ListFilterForm action="/reports/commission" hasFilters={hasFilters}>
          <FaDateField name="from" defaultValue={range.from ?? ''} label="از تاریخ" />
          <FaDateField name="to" defaultValue={range.to ?? ''} label="تا تاریخ" />
        </ListFilterForm>

        {percent === null ? (
          <Text size="sm" c="orange.7" mb="md">
            درصد پورسانت از بک‌آفیس کور خوانده نشد؛ کارمزد موقتاً صفر لحاظ شده است.
          </Text>
        ) : null}

        <Text size="xs" c="dimmed" mb={-6}>
          واحد مبالغ: تومان
        </Text>

        <CommissionTable rows={rows} percent={percent} filtered={hasFilters} />
      </Card>
    </Stack>
  );
}
