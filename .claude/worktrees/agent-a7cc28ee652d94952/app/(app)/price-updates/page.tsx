import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { IconHistory } from '@tabler/icons-react';
import { Anchor, Card, Group, Text } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import PriceUpdatePanel, { type PriceCategoryOption } from '@/components/price/PriceUpdatePanel';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { listCategories } from '@/lib/categories';
import { faNumber } from '@/lib/format';
import { countPriceChanges } from '@/lib/price-updates';
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
 *
 * The history itself now lives on its own page (/price-history) so it can be
 * filtered by date, group and product independently of this page's permission.
 */
export default async function PriceUpdatesPage() {
  const session = await requireSession('/price-updates');

  // The API enforces this too; the redirect just avoids dead controls for staff
  // whose role was not granted this menu.
  if (!canAccessMenu(session, '/price-updates')) {
    redirect('/dashboard');
  }

  const [products, categoryTree, changeCount] = await Promise.all([
    listProducts(),
    listCategories(),
    countPriceChanges(),
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
        description={`تغییر گروهی قیمت کالاها و نوع‌هایشان — ${faNumber(products.length)} کالا، ${faNumber(changeCount)} تغییر ثبت‌شده`}
      />
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
      <Card withBorder padding="md" mt="xl">
        <Group justify="space-between" gap="sm">
          <Group gap="xs">
            <IconHistory size={18} />
            <Text size="sm">
              تاریخچه کامل تغییر قیمت‌ها با فیلتر تاریخ، گروه کالا و کالا در صفحه‌ای جداگانه است.
            </Text>
          </Group>
          {/*
            A plain href, not `component={Link}`: this page is a server
            component, and Next's Link is a function — passing it as a prop to
            Mantine's client-side Anchor throws "Functions cannot be passed
            directly to Client Components".
          */}
          <Anchor href="/price-history" size="sm" fw={600}>
            مشاهده تاریخچه تغییر قیمت‌ها
          </Anchor>
        </Group>
      </Card>
    </>
  );
}
