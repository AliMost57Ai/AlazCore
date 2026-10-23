import { Suspense } from 'react';
import { Card, Stack, Text } from '@mantine/core';
import { requireApiMenu } from '@/lib/auth';
import {
  listSiteCategories,
  listSiteOptions,
  reportProductSales,
  type ReportFilters,
} from '@/lib/site-queries';
import ReportFilterBar from '../ReportFilterBar';
import ReportDocument from '@/components/ReportDocument';

export const metadata = { title: 'گزارش فروش هر کالا' };
export const dynamic = 'force-dynamic';

function money(value: number): string {
  return `${new Intl.NumberFormat('en-US').format(value)} تومان`;
}

/** گزارش ۲ — خلاصه فروش هر کالا در هر سایت (فیلتر: تاریخ، دامنه، گروه، نام). */
export default async function ProductSalesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireApiMenu('/panel/reports/product-sales');
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
    reportProductSales(filters),
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
        title="گزارش فروش هر کالا به تفکیک سایت"
        exportHref="/api/reports/product-sales/export"
        exportQuery={new URLSearchParams(
          Object.entries(filters).filter(([, v]) => v) as [string, string][]
        ).toString()}
        filtersSummary={filtersSummary}
        headers={['دامنه سایت', 'کالا', 'تعداد فروش', 'مبلغ فروش (تومان)']}
        footerTotal={[{ label: 'جمع کل فروش', value: money(grand) }]}
      >
        {rows.flatMap((row) => [
          ...row.items.map((item) => (
            <tr key={`${row.domain}-${item.name}`}>
              <td dir="ltr" style={{ textAlign: 'right' }}>
                {row.domain}
              </td>
              <td>{item.name}</td>
              <td style={{ textAlign: 'center' }}>
                {new Intl.NumberFormat('en-US').format(item.qty)}
              </td>
              <td style={{ textAlign: 'center' }}>{money(item.revenue)}</td>
            </tr>
          )),
          <tr
            key={`${row.domain}-sum`}
            style={{ background: 'var(--mantine-color-gray-0)' }}
          >
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
