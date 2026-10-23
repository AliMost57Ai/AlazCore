import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ProductForm from '@/components/products/ProductForm';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { listBrandOptions } from '@/lib/brands';
import { listCategoryOptions } from '@/lib/categories';
import { canManageOversell, currentDomain, getLicense } from '@/lib/core-license';
import { placementTargets } from '@/lib/section-placements';
import { getActiveThemeId } from '@/lib/theme-settings';
import { THEME_MAP } from '@/lib/themes';

export const metadata: Metadata = {
  title: 'محصول جدید',
};

export default async function NewProductPage() {
  const session = await requireSession('/products/new');

  // The API enforces this too; the redirect just avoids a dead form for staff
  // whose role was not granted the add action.
  if (!canAccessMenu(session, '/products', 'add')) {
    redirect('/products');
  }

  const [categoryOptions, brandOptions, activeThemeId] = await Promise.all([
    listCategoryOptions(),
    listBrandOptions(),
    getActiveThemeId(),
  ]);

  const oversell = (await getLicense(await currentDomain()))?.oversell ?? null;
  const canOversell = await canManageOversell(session);

  return (
    <Stack gap="lg">
      <PageHeader title="محصول جدید" description="اطلاعات محصول را وارد کنید." />
      <ProductForm
        oversell={oversell}
        canOversell={canOversell}
        mode="create"
        categoryOptions={categoryOptions.map((option) => ({
          value: option.id,
          label: option.label,
        }))}
        brandOptions={brandOptions.map((option) => ({
          value: option.id,
          label: option.label,
        }))}
        sectionOptions={placementTargets(activeThemeId).map((target) => ({
          value: target.id,
          label: target.label,
        }))}
        activeThemeName={THEME_MAP[activeThemeId].name}
      />
    </Stack>
  );
}
