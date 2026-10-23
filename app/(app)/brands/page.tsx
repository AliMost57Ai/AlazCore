import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Anchor, Group, Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ListActions from '@/components/ui/panel/ListActions';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { listBrands } from '@/lib/brands';
import { enNumber } from '@/lib/format';
import BrandsClient from './BrandsClient';

export const metadata: Metadata = {
  title: 'برندها',
};

/** لیست برندها — تعریف/ویرایش با صفحه اختصاصی (قاعده modal-to-page). */
export default async function BrandsPage() {
  const session = await requireSession('/brands');
  if (!canAccessMenu(session, '/brands')) {
    redirect('/dashboard');
  }

  const brands = await listBrands();
  const canAdd = canAccessMenu(session, '/brands', 'add');
  const canEdit = canAccessMenu(session, '/brands', 'edit');

  return (
    <Stack gap="lg">
      <PageHeader
        title="برندها"
        description={`${enNumber(brands.length)} برند — برند روی محصول، کارت و فیلتر فروشگاه نمایش داده می‌شود.`}
        actions={
          <Group gap="sm" wrap="nowrap" className="no-print">
            <ListActions exportHref="/api/export/brands" />
            {canAdd ? (
              <Anchor
                href="/brands/new"
                size="sm"
                fw={600}
                c="brand"
                px="sm"
                py={6}
                style={{ border: '1px solid var(--mantine-color-brand-3)', borderRadius: 8 }}
              >
                + برند جدید
              </Anchor>
            ) : null}
          </Group>
        }
      />
      <BrandsClient initial={brands} canAdd={canAdd} canEdit={canEdit} />
    </Stack>
  );
}
