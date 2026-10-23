import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Stack, Text } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import CashFlowTable from '@/components/reports/CashFlowTable';
import FaDateField from '@/components/ui/FaDateField';
import ListActions from '@/components/ui/panel/ListActions';
import ListFilterForm from '@/components/ui/panel/ListFilterForm';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { cashFlowReport, hasRange } from '@/lib/financial-reports';
import { enCurrency, enNumber } from '@/lib/format';

export const metadata: Metadata = {
  title: 'جریان نقدی',
};

export const dynamic = 'force-dynamic';

/**
 * گزارش ۴ — جریان نقدی روزانه: دفتر درگاه (دریافت واقعی برای سفارش و شارژ
 * کیف پول) کنار دفتر کیف پول (پرداخت/بازگشت/تنظیم ادمین). شارژ از دفتر درگاه
 * شمرده می‌شود تا پول دوبار حساب نشود؛ پول پس‌کرایه هنگام تحویل وصول می‌شود
 * و در این دفتر نیست.
 */
export default async function CashFlowReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession('/reports/cash-flow');
  if (!canAccessMenu(session, '/reports/cash-flow')) {
    redirect('/dashboard');
  }

  const raw = await searchParams;
  const one = (key: string): string | undefined => {
    const value = raw[key];
    return typeof value === 'string' && value ? value : undefined;
  };
  const range = { from: one('from'), to: one('to') };
  const { rows, totals } = await cashFlowReport(range);
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
        title="جریان نقدی"
        description={`${enNumber(rows.length)} روز — جمع ورودی نقدی ${enCurrency(
          totals.cashIn,
          false
        )} تومان`}
        actions={
          <ListActions
            exportHref={`/api/export/cash-flow${
              exportParams.size > 0 ? `?${exportParams.toString()}` : ''
            }`}
          />
        }
      />

      <Card>
        <ListFilterForm action="/reports/cash-flow" hasFilters={hasFilters}>
          <FaDateField name="from" defaultValue={range.from ?? ''} label="از تاریخ" />
          <FaDateField name="to" defaultValue={range.to ?? ''} label="تا تاریخ" />
        </ListFilterForm>

        <Text size="xs" c="dimmed" mb={-6}>
          واحد مبالغ: تومان
        </Text>

        <CashFlowTable rows={rows} filtered={hasFilters} />
      </Card>
    </Stack>
  );
}
