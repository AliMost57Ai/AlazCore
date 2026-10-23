import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Button, Card, Group, Stack, Text } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import PriceHistoryFilters from '@/components/price/PriceHistoryFilters';
import PriceHistoryTable from '@/components/price/PriceHistoryTable';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { listCategories } from '@/lib/categories';
import { faNumber } from '@/lib/format';
import { listPriceChangeHistory } from '@/lib/price-updates';
import { listProducts } from '@/lib/products';

export const metadata: Metadata = {
  title: 'تاریخچه تغییر قیمت',
};

/**
 * Finance → تاریخچه تغییر قیمت: the full audit trail of batch price updates,
 * filterable by date range, product group/category and product.
 *
 * This lives on its own top-level route rather than under /price-updates
 * because menu permissions match by path prefix (`hrefMatches`) — a nested
 * /price-updates/history could never be granted to a role without also handing
 * it the price-update page itself.
 */
export default async function PriceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    category?: string;
    product?: string;
    page?: string;
  }>;
}) {
  const session = await requireSession('/price-history');

  // The API-level guard is the menu permission; this redirect just keeps a
  // staff member without the grant from landing on an empty page.
  if (!canAccessMenu(session, '/price-history')) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const from = params.from ?? '';
  const to = params.to ?? '';
  const category = params.category ?? '';
  const product = params.product ?? '';
  const parsedPage = Number.parseInt(params.page ?? '1', 10);

  const [result, categoryTree, products] = await Promise.all([
    listPriceChangeHistory(
      { from, to, categoryId: category, productId: product },
      Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
    ),
    listCategories(),
    listProducts(),
  ]);

  // Flat «گروه › دسته» options — the same shape the price-update panel uses, so
  // choosing a group covers its sub-categories too (the server walks children).
  const categories = categoryTree.flatMap((group) => [
    { value: group.id, label: `${group.name} (گروه)` },
    ...group.children.map((child) => ({ value: child.id, label: `${group.name} › ${child.name}` })),
  ]);

  const filtered = from !== '' || to !== '' || category !== '' || product !== '';

  function pageHref(next: number): string {
    const query = new URLSearchParams();
    if (from) {
      query.set('from', from);
    }
    if (to) {
      query.set('to', to);
    }
    if (category) {
      query.set('category', category);
    }
    if (product) {
      query.set('product', product);
    }
    if (next > 1) {
      query.set('page', String(next));
    }
    const search = query.toString();
    return search === '' ? '/price-history' : `/price-history?${search}`;
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title="تاریخچه تغییر قیمت"
        description={
          result.batches.length === 0
            ? result.page > 1
              ? 'در این صفحه تغییری نیست.'
              : filtered
                ? 'با این فیلترها تغییری پیدا نشد.'
                : 'هنوز تغییری در قیمت‌ها ثبت نشده است.'
            : `${faNumber(result.batches.length)} تغییر در این صفحه${filtered ? ' (فیلترشده)' : ''}`
        }
      />

      <PriceHistoryFilters
        categories={categories}
        products={products.map((item) => ({ value: item.id, label: item.name }))}
        initial={{ from, to, category, product }}
      />

      <PriceHistoryTable batches={result.batches} />

      {result.page > 1 || result.hasMore ? (
        <Card withBorder padding="sm">
          <Group justify="space-between">
            {/*
              `component="a"` (a string), never `component={Link}`: this is a
              server component, and Next's Link is a function — handing it to
              Mantine's client-side Button throws "Functions cannot be passed
              directly to Client Components". A real anchor also keeps
              middle-click and open-in-new-tab working while paging.
            */}
            <Button
              component="a"
              href={pageHref(result.page - 1)}
              variant="default"
              size="sm"
              disabled={result.page <= 1}
            >
              صفحه قبل
            </Button>
            <Text size="sm" c="dimmed">
              صفحه {faNumber(result.page)}
            </Text>
            <Button
              component="a"
              href={pageHref(result.page + 1)}
              variant="default"
              size="sm"
              disabled={!result.hasMore}
            >
              صفحه بعد
            </Button>
          </Group>
        </Card>
      ) : null}
    </Stack>
  );
}
