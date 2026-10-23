import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import BrandForm from '@/components/brands/BrandForm';
import { canAccessMenu, requireSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'برند جدید',
};

/** صفحه اختصاصی تعریف برند — فرم‌های برند صفحه دارند نه مودال. */
export default async function NewBrandPage() {
  const session = await requireSession('/brands/new');

  if (!canAccessMenu(session, '/brands', 'add')) {
    redirect('/brands');
  }

  return (
    <Stack gap="lg">
      <PageHeader title="برند جدید" description="برند روی محصول، کارت و فیلتر فروشگاه نمایش داده می‌شود." />
      <BrandForm />
    </Stack>
  );
}
