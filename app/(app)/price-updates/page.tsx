import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Alert, Title } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import PriceHistoryTable from '@/components/price/PriceHistoryTable';
import PriceUpdatePanel, { type PriceCategoryOption } from '@/components/price/PriceUpdatePanel';
import ListActions from '@/components/ui/panel/ListActions';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { listCategories } from '@/lib/categories';
import { enNumber } from '@/lib/format';
import { listPriceChangeBatches } from '@/lib/price-updates';
import { listProducts } from '@/lib/products';

export const metadata: Metadata = {
  title: 'به‌روزرسانی قیمت',
};

/**
 * Finance → به‌روزرسانی قیمت: raise/lower prices of a whole group/category
 * (recursively) or one product (variants included) by a fixed Toman amount or
 * a percent, in one batch. Every actual change is written to the PriceChange
 * history; sold invoices keep their original prices (Order.itemsJson
 * snapshots each line's unitPrice), so accounting is never disturbed.
 */
export default async function PriceUpdatesPage() {
  const session = await requireSession('/price-updates');

  // The API enforces this too; the redirect just avoids dead controls for staff
  // whose role was not granted this menu.
  if (!canAccessMenu(session, '/price-updates')) {
    redirect('/dashboard');
  }

  // The API enforces this too; hiding the form just avoids dead controls for
  // staff whose role was not granted the edit action (read-only history).
  const canEdit = canAccessMenu(session, '/price-updates', 'edit');

  const [products, categoryTree, batches] = await Promise.all([
    listProducts(),
    listCategories(),
    listPriceChangeBatches(),
  ]);

  // Flat «گروه › دسته» options, each with the ids it covers (itself + children)
  // so the client-side preview can resolve a group's products without a server call.
  const categories: PriceCategoryOption[] = categoryTree.flatMap((group) => [
    {
      id: group.id,
      label: `${group.name} (گروه)`,
      covers: [group.id, ...group.children.map((child) => child.id)],
    },
    ...group.children.map((child) => ({
      id: child.id,
      label: `${group.name} › ${child.name}`,
      covers: [child.id],
    })),
  ]);

  return (
    <>
      <PageHeader
        title="به‌روزرسانی قیمت"
        description={`تغییر گروهی قیمت کالاها و نوع‌هایشان — ${enNumber(products.length)} کالا، ${enNumber(batches.length)} تغییر ثبت‌شده`}
        actions={<ListActions exportHref="/api/export/price-updates" />}
      />
      {canEdit ? (
        <PriceUpdatePanel
          categories={categories}
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            price: product.price,
            categoryIds: product.categoryIds,
            variants: product.variants.map((variant) => ({
              id: variant.id,
              name: variant.name,
              price: variant.price,
            })),
          }))}
        />
      ) : (
        <Alert variant="light" color="brand">
          برای نقش شما فقط مشاهدهٔ تاریخچه تغییر قیمت‌ها مجاز است.
        </Alert>
      )}
      <Title order={2} fz="h4" mt="xl" mb="md">
        تاریخچه تغییر قیمت‌ها
      </Title>
      <PriceHistoryTable batches={batches} />
    </>
  );
}
