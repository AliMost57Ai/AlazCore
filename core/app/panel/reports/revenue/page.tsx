import { Suspense } from 'react';
import { Card, Stack, Text } from '@mantine/core';
import { requireApiMenu } from '@/lib/auth';
import {
  listSiteCategories,
  listSiteOptions,
  reportRevenue,
  type ReportFilters,
} from '@/lib/site-queries';
import ReportFilterBar from '../ReportFilterBar';
import ReportDocument from '@/components/ReportDocument';

export const metadata = { title: 'گزارش درآمد آلازکور' };
export const dynamic = 'force-dynamic';

function money(value: number): string {
  return `${new Intl.NumberFormat('en-US').format(value)} تومان`;
}

/** گزارش ۴ — درآمد آلازکور = درصد پورسانت هر دامنه × فروش فیلترشده. */
export default async function RevenueReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireApiMenu('/panel/reports/revenue');
  const params = await searchParams;
  const one = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === 'string' && value ? value : undefined;
  };
  const filters: ReportFilters = {
    domain: one('domain'),
    from: one('from'),
    to: one('to'),
    categoryId: one('categoryId'),
    productName: one('productName'),
  };

  const [domains, categories, report] = await Promise.all([
    listSiteOptions(),
    filters.domain ? listSiteCategories(filters.domain) : Promise.resolve([]),
    reportRevenue(filters),
  ]);

  const filtersSummary = [
    filters.domain ? `دامنه: ${filters.domain}` : 'دامنه: همه سایت‌ها',
    filters.from || filters.to ? `بازه: ${filters.from ?? '…'} تا ${filters.to ?? '…'}` : null,
    filters.categoryId
      ? `گروه کالا: ${categories.find((c) => c.id === filters.categoryId)?.name ?? filters.categoryId}`
      : null,
    filters.productName ? `کالا: ${filters.productName}` : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <Stack gap="lg">
      <Card padding="lg" withBorder className="no-print">
        <Suspense>
          <ReportFilterBar domains={domains} categories={categories} />
        </Suspense>
      </Card>

      <ReportDocument
        title="گزارش درآمد شرکت آلازکور"
        exportHref="/api/reports/revenue/export"
        exportQuery={new URLSearchParams(
          Object.entries(filters).filter(([, v]) => v) as [string, string][]
        ).toString()}
        filtersSummary={filtersSummary}
        headers={['دامنه سایت', 'فروش (تومان)', 'درصد پورسانت', 'درآمد آلازکور (تومان)']}
        footerTotal={[{ label: 'جمع کل درآمد آلازکور', value: money(report.totalRevenue) }]}
      >
        {report.rows.map((row) => (
          <tr key={row.domain}>
            <td dir="ltr" style={{ textAlign: 'right', fontWeight: 600 }}>
              {row.domain}
            </td>
            <td style={{ textAlign: 'center' }}>{money(row.totalSales)}</td>
            <td style={{ textAlign: 'center' }}>
              {new Intl.NumberFormat('en-US').format(row.commissionPercent)}٪
            </td>
            <td style={{ textAlign: 'center', fontWeight: 700 }}>{money(row.revenue)}</td>
          </tr>
        ))}
      </ReportDocument>

      <Text size="xs" c="dimmed" className="no-print">
        مبنای «فروش»، سفارش‌های به‌جز در انتظار پرداخت و لغوشده است؛ درصد پورسانت از تنظیمات هر
        دامنه در مدیریت دامین‌ها خوانده می‌شود.
      </Text>
    </Stack>
  );
}
