import { Suspense } from 'react';
import { Card, Stack, Text } from '@mantine/core';
import { requireApiMenu } from '@/lib/auth';
import {
  listSiteCategories,
  listSiteOptions,
  reportMonthlySales,
  type ReportFilters,
} from '@/lib/site-queries';
import ReportFilterBar from '../ReportFilterBar';
import ReportDocument from '@/components/ReportDocument';

export const metadata = { title: 'گزارش فروش ماهانه' };
export const dynamic = 'force-dynamic';

function money(value: number): string {
  return `${new Intl.NumberFormat('en-US').format(value)} تومان`;
}

/** گزارش ۳ — مجموع فروش به تفکیک سایت در ماه (فیلتر: تاریخ، دامنه، گروه کالا، نام کالا). */
export default async function MonthlySalesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireApiMenu('/panel/reports/monthly-sales');
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

  const [domains, categories, rows] = await Promise.all([
    listSiteOptions(),
    filters.domain ? listSiteCategories(filters.domain) : Promise.resolve([]),
    reportMonthlySales(filters),
  ]);

  const filtersSummary = [
    filters.domain ? `دامنه: ${filters.domain}` : 'دامنه: همه سایت‌ها',
    filters.from || filters.to ? `بازه: ${filters.from ?? '…'} تا ${filters.to ?? '…'}` : null,
    filters.categoryId
      ? `گروه کالا: ${categories.find((c) => c.id === filters.categoryId)?.name ?? filters.categoryId}`
      : null,
    filters.productName ? `کالا: ${filters.productName}` : null,
  ].filter((item): item is string => Boolean(item));

  const grand = rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <Stack gap="lg">
      <Card padding="lg" withBorder className="no-print">
        <Suspense>
          <ReportFilterBar domains={domains} categories={categories} />
        </Suspense>
      </Card>

      <ReportDocument
        title="گزارش مجموع فروش به تفکیک سایت در ماه"
        exportHref="/api/reports/monthly-sales/export"
        exportQuery={new URLSearchParams(
          Object.entries(filters).filter(([, v]) => v) as [string, string][]
        ).toString()}
        filtersSummary={filtersSummary}
        headers={['دامنه سایت', 'ماه', 'تعداد سفارش', 'مبلغ فروش (تومان)']}
        footerTotal={[{ label: 'جمع کل فروش', value: money(grand) }]}
      >
        {/* ردیف‌ها عمداً <tr>/<td> خام هستند: compoundهای Mantine (Table.Tr/Td)
            در Server Component زیر optimizePackageImports undefined می‌شوند —
            همان الگوی مستندشده در components/ReportDocument.tsx فروشگاه. */}
        {rows.flatMap((row) => [
          ...row.months.map((month) => (
            <tr key={`${row.domain}-${month.month}`}>
              <td dir="ltr" style={{ textAlign: 'right' }}>
                {row.domain}
              </td>
              <td style={{ textAlign: 'center', fontWeight: 600 }}>{month.month}</td>
              <td style={{ textAlign: 'center' }}>
                {new Intl.NumberFormat('en-US').format(month.orders)}
              </td>
              <td style={{ textAlign: 'center' }}>{money(month.total)}</td>
            </tr>
          )),
          <tr key={`${row.domain}-sum`} style={{ background: 'var(--mantine-color-gray-0)' }}>
            <td dir="ltr" style={{ textAlign: 'right', fontWeight: 700 }}>
              {row.domain}
            </td>
            <td style={{ fontWeight: 700 }}>جمع سایت</td>
            <td />
            <td style={{ textAlign: 'center', fontWeight: 700 }}>{money(row.total)}</td>
          </tr>,
        ])}
      </ReportDocument>
    </Stack>
  );
}
