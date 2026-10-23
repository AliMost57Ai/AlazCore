import { Suspense } from 'react';
import { Card, Stack, Text } from '@mantine/core';
import { requireApiMenu } from '@/lib/auth';
import {
  listSiteCategories,
  listSiteOptions,
  reportProducts,
  type ReportFilters,
} from '@/lib/site-queries';
import ReportFilterBar from '../ReportFilterBar';
import ReportDocument from '@/components/ReportDocument';

export const metadata = { title: 'گزارش محصولات' };
export const dynamic = 'force-dynamic';

/** گزارش ۱ — محصولات تعریف‌شده هر سایت (فیلتر: دامنه، گروه کالا، نام کالا). */
export default async function ProductsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireApiMenu('/panel/reports/products');
  const params = await searchParams;
  const one = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === 'string' && value ? value : undefined;
  };
  const filters: ReportFilters = {
    domain: one('domain'),
    categoryId: one('categoryId'),
    productName: one('productName'),
  };

  const [domains, categories, rows] = await Promise.all([
    listSiteOptions(),
    filters.domain ? listSiteCategories(filters.domain) : Promise.resolve([]),
    reportProducts(filters),
  ]);

  const filtersSummary = [
    filters.domain ? `دامنه: ${filters.domain}` : 'دامنه: همه سایت‌ها',
    filters.categoryId
      ? `گروه کالا: ${categories.find((c) => c.id === filters.categoryId)?.name ?? filters.categoryId}`
      : null,
    filters.productName ? `کالا: ${filters.productName}` : null,
  ].filter((item): item is string => Boolean(item));

  const totalCount = rows.reduce((sum, row) => sum + row.productCount, 0);

  return (
    <Stack gap="lg">
      <Card padding="lg" withBorder className="no-print">
        <Suspense>
          <ReportFilterBar domains={domains} categories={categories} showDate={false} />
        </Suspense>
      </Card>

      <ReportDocument
        title="گزارش محصولات تعریف‌شده هر سایت"
        exportHref="/api/reports/products/export"
        exportQuery={new URLSearchParams(
          Object.entries(filters).filter(([, v]) => v) as [string, string][]
        ).toString()}
        filtersSummary={filtersSummary}
        headers={['دامنه سایت', 'تعداد محصولات', 'نمونه محصولات']}
        footerTotal={[
          { label: 'جمع کل محصولات', value: new Intl.NumberFormat('en-US').format(totalCount) },
        ]}
      >
        {rows.map((row) => (
          <tr key={row.domain}>
            <td dir="ltr" style={{ textAlign: 'right', fontWeight: 600 }}>
              {row.domain}
            </td>
            <td style={{ textAlign: 'center' }}>
              {new Intl.NumberFormat('en-US').format(row.productCount)}
            </td>
            <td style={{ color: 'var(--mantine-color-dimmed)' }}>
              {row.sample.length > 0 ? row.sample.join('، ') : '—'}
              {row.error ? (
                <Text size="xs" c="orange">
                  {row.error}
                </Text>
              ) : null}
            </td>
          </tr>
        ))}
      </ReportDocument>
    </Stack>
  );
}
