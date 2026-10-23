import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Button, Card, Group, Select, Stack, TextInput } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ExportProductsButton from '@/components/products/ExportProductsButton';
import ImportPricesButton from '@/components/products/ImportPricesButton';
import NewProductButton from '@/components/products/NewProductButton';
import ProductsTable from '@/components/products/ProductsTable';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { faNumber } from '@/lib/format';
import { countVisibleProducts, listProducts } from '@/lib/products';

export const metadata: Metadata = {
  title: 'محصولات',
};

/**
 * Product list. searchParams (Promise in Next 15+) drive the search box and
 * visibility filter — plain links/form submits, no client router code needed.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; visibility?: string }>;
}) {
  const session = await requireSession('/products');
  // The API enforces this too; the redirect just avoids dead controls for staff
  // whose role was not granted this menu.
  if (!canAccessMenu(session, '/products')) {
    redirect('/dashboard');
  }
  const { q, visibility } = await searchParams;
  // Price import belongs to the price-updates menu, not plain product access.
  const canUpdatePrices = canAccessMenu(session, '/price-updates', 'edit');
  const canAdd = canAccessMenu(session, '/products', 'add');
  const canEdit = canAccessMenu(session, '/products', 'edit');

  const visibilityFilter =
    visibility === 'true' ? true : visibility === 'false' ? false : undefined;
  const search = q?.trim() || undefined;
  const products = await listProducts({
    search,
    visibility: visibilityFilter,
  });
  const visibleCount = await countVisibleProducts();

  // The export endpoint takes the same filters, and the exported sheet doubles
  // as the price-import template (with variant rows).
  const exportParams = new URLSearchParams();
  if (search) {
    exportParams.set('q', search);
  }
  if (visibilityFilter !== undefined) {
    exportParams.set('visibility', String(visibilityFilter));
  }
  const exportHref = `/api/export/products${
    exportParams.size > 0 ? `?${exportParams.toString()}` : ''
  }`;

  // Native form GET: the inputs carry the query to /products as searchParams.
  return (
    <Stack gap="lg">
      <PageHeader
        title="محصولات"
        description={`${faNumber(products.length)} محصول — ${faNumber(visibleCount)} نمایان`}
        actions={
          <Group gap="xs">
            {canUpdatePrices ? <ImportPricesButton templateHref={exportHref} /> : null}
            <ExportProductsButton href={exportHref} />
            <NewProductButton canAdd={canAdd} />
          </Group>
        }
      />

      <Card>
        {/* Filter form stacks on mobile and sits in one row from xs up — the
            same shape as the orders page filters. */}
        <form method="get" action="/products">
          <Group gap="sm" mb="md" wrap="wrap">
            <TextInput
              name="q"
              defaultValue={q ?? ''}
              placeholder="جستجوی نام محصول…"
              size="sm"
              radius="md"
              aria-label="جستجوی محصول"
              style={{ flex: '1 1 220px' }}
            />
            <Select
              name="visibility"
              data={[
                { value: '', label: 'همه' },
                { value: 'true', label: 'نمایان' },
                { value: 'false', label: 'پنهان' },
              ]}
              defaultValue={visibility ?? ''}
              size="sm"
              radius="md"
              w={{ base: '100%', xs: 160 }}
              aria-label="فیلتر نمایش"
            />
            <Button type="submit" variant="default" size="sm" radius="md">
              جستجو
            </Button>
          </Group>
        </form>

        <ProductsTable products={products} canEdit={canEdit} />
      </Card>
    </Stack>
  );
}
