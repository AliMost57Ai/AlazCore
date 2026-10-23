'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconBrandSafari, IconPencil, IconTrash } from '@tabler/icons-react';
import { ActionIcon, Badge, Group, Image, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import { enNumber } from '@/lib/format';
import type { BrandDTO } from '@/lib/brands';

/**
 * لیست برندها روی PanelList — قاعده واحد لیست‌های پنل. تعریف/ویرایش صفحه
 * اختصاصی دارد (/brands/new و /brands/[id]/edit)؛ حذف ردیفی است و با قاعده
 * «در حال استفاده» سمت سرور رد می‌شود (خطای فارسی در toast).
 */
export default function BrandsClient({
  initial,
  canAdd,
  canEdit,
}: {
  initial: BrandDTO[];
  canAdd: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [brands, setBrands] = useState<BrandDTO[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(brand: BrandDTO) {
    setBusyId(brand.id);
    try {
      const response = await fetch(`/api/admin/brands?id=${encodeURIComponent(brand.id)}`, {
        method: 'DELETE',
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'حذف برند ناموفق بود.',
          color: 'red',
        });
        return;
      }
      notifications.show({ message: 'برند حذف شد.', color: 'brand' });
      setBrands((current) => current.filter((row) => row.id !== brand.id));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const columns: PanelColumn<BrandDTO>[] = [
    {
      key: 'name',
      header: 'برند',
      cardTitle: true,
      sortValue: (brand) => brand.name,
      cell: (brand) => (
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          {brand.logoPath ? (
            <Image
              src={`/api/files/${brand.logoPath}`}
              alt={brand.name}
              h={32}
              w={48}
              fit="contain"
              radius="sm"
              style={{ background: 'var(--mantine-color-body)' }}
            />
          ) : null}
          <Text size="sm" fw={600} truncate style={{ minWidth: 0 }}>
            {brand.name}
          </Text>
        </Group>
      ),
    },
    {
      key: 'slug',
      header: 'اسلاگ',
      desktopOnly: true,
      cell: (brand) => (
        <Text size="xs" ff="monospace" style={{ direction: 'ltr' }}>
          {brand.slug}
        </Text>
      ),
    },
    {
      key: 'productCount',
      header: 'محصولات',
      w: 110,
      sortValue: (brand) => brand.productCount,
      cell: (brand) => (
        <Text size="sm">{enNumber(brand.productCount)} کالا</Text>
      ),
    },
    {
      key: 'status',
      header: 'وضعیت',
      cardHead: true,
      sortValue: (brand) => (brand.isActive ? 1 : 0),
      cell: (brand) => (
        <Badge size="sm" variant="light" color={brand.isActive ? 'teal' : 'gray'}>
          {brand.isActive ? 'فعال' : 'غیرفعال'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'عملیات',
      w: 120,
      cell: (brand) =>
        canEdit ? (
          <Group gap="xs" wrap="nowrap">
            <Tooltip label="ویرایش">
              <ActionIcon
                component={Link}
                href={`/brands/${brand.id}/edit`}
                variant="subtle"
                color="brand"
                aria-label={`ویرایش برند ${brand.name}`}
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="حذف">
              <ActionIcon
                variant="subtle"
                color="red"
                disabled={busyId === brand.id}
                aria-label={`حذف برند ${brand.name}`}
                onClick={() => void remove(brand)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : null,
    },
  ];

  return (
    <PanelList<BrandDTO>
      rows={brands}
      columns={columns}
      getRowId={(brand) => brand.id}
      detailHref={canEdit ? (brand) => `/brands/${brand.id}/edit` : undefined}
      detailLabel={(brand) => `ویرایش برند «${brand.name}»`}
      empty={{
        icon: IconBrandSafari,
        message: 'برندی تعریف نشده است.',
        hint: canAdd
          ? 'با «برند جدید» اولین برند را بسازید تا روی محصولات و فیلتر فروشگاه ظاهر شود.'
          : 'برندها توسط مدیر تعریف می‌شوند.',
      }}
    />
  );
}
