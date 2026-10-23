import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ProductForm from '@/components/products/ProductForm';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { getCategoryOptions, getProductCategoryIds } from '@/lib/categories';
import { getProduct } from '@/lib/products';
import { placementTargets } from '@/lib/section-placements';
import { getActiveThemeId } from '@/lib/theme-settings';
import { THEME_MAP } from '@/lib/themes';

export const metadata: Metadata = {
  title: 'ویرایش محصول',
};

type PageProps = { params: Promise<{ id: string }> };

export default async function EditProductPage({ params }: PageProps) {
  const session = await requireSession('/products');

  if (!canAccessMenu(session, '/products', 'edit')) {
    redirect('/products');
  }

  const { id } = await params;
  const [product, categoryOptions, categoryIds, activeThemeId] = await Promise.all([
    getProduct(id),
    getCategoryOptions(),
    getProductCategoryIds(id),
    getActiveThemeId(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <Stack gap="lg">
      <PageHeader title={`ویرایش «${product.name}»`} description="تغییرات خود را ذخیره کنید." />
      <ProductForm
        mode="edit"
        product={product}
        categoryOptions={categoryOptions.map((option) => ({
          value: option.id,
          label: option.label,
        }))}
        categoryIds={categoryIds}
        sectionOptions={placementTargets(activeThemeId).map((target) => ({
          value: target.id,
          label: target.label,
        }))}
        activeThemeName={THEME_MAP[activeThemeId].name}
        sectionIds={product.placements[activeThemeId] ?? []}
      />
    </Stack>
  );
}
