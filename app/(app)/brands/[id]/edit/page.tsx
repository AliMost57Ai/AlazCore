import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import BrandForm from '@/components/brands/BrandForm';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { getBrand } from '@/lib/brands';

export const metadata: Metadata = {
  title: 'ویرایش برند',
};

type PageProps = { params: Promise<{ id: string }> };

/** صفحه اختصاصی ویرایش برند. */
export default async function EditBrandPage({ params }: PageProps) {
  const session = await requireSession('/brands');

  if (!canAccessMenu(session, '/brands', 'edit')) {
    redirect('/brands');
  }

  const { id } = await params;
  const brand = await getBrand(decodeURIComponent(id));
  if (!brand) {
    notFound();
  }

  return (
    <Stack gap="lg">
      <PageHeader title={`ویرایش برند — ${brand.name}`} description={`${brand.productCount} محصول به این برند وصال است.`} />
      <BrandForm brand={brand} />
    </Stack>
  );
}
