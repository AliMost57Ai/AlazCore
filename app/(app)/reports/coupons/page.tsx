import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Stack, Text } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import CouponReportTable from '@/components/reports/CouponReportTable';
import FaDateField from '@/components/ui/FaDateField';
import ListActions from '@/components/ui/panel/ListActions';
import ListFilterForm from '@/components/ui/panel/ListFilterForm';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { couponReport, hasRange } from '@/lib/financial-reports';
import { enCurrency, enNumber } from '@/lib/format';

export const metadata: Metadata = {
  title: 'عملکرد کدهای تخفیف',
};

export const dynamic = 'force-dynamic';

/**
 * گزارش ۲ — عملکرد کدهای تخفیف: استفاده یکتا (ledger رستمی)، سفارش، فروش،
 * مبلغ تخفیف داده‌شده و سهم تخفیف از فروش برای هر کد. کدهای حذف‌شده هم از
 * روی سفارش‌هایشان دیده می‌شوند (وضعیت «حذف‌شده»).
 */
export default async function CouponReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession('/reports/coupons');
  if (!canAccessMenu(session, '/reports/coupons')) {
    redirect('/dashboard');
  }

  const raw = await searchParams;
  const one = (key: string): string | undefined => {
    const value = raw[key];
    return typeof value === 'string' && value ? value : undefined;
  };
  const range = { from: one('from'), to: one('to') };
  const { rows, totals } = await couponReport(range);
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
        title="عملکرد کدهای تخفیف"
        description={`${enNumber(rows.length)} کد — ${enNumber(
          totals.orders
        )} سفارش — تخفیف داده‌شده ${enCurrency(totals.discount, false)} تومان`}
        actions={
          <ListActions
            exportHref={`/api/export/coupon-performance${
              exportParams.size > 0 ? `?${exportParams.toString()}` : ''
            }`}
          />
        }
      />

      <Card>
        <ListFilterForm action="/reports/coupons" hasFilters={hasFilters}>
          <FaDateField name="from" defaultValue={range.from ?? ''} label="از تاریخ" />
          <FaDateField name="to" defaultValue={range.to ?? ''} label="تا تاریخ" />
        </ListFilterForm>

        <Text size="xs" c="dimmed" mb={-6}>
          واحد مبالغ: تومان
        </Text>

        <CouponReportTable rows={rows} filtered={hasFilters} />
      </Card>
    </Stack>
  );
}
