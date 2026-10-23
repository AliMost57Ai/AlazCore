'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconEye, IconEyeOff, IconPencil, IconTrash } from '@tabler/icons-react';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { applyDiscount, enCurrency, enNumber, enPercent } from '@/lib/format';
import type { ProductDTO } from '@/lib/products';

export interface ProductsTableProps {
  products: ProductDTO[];
  /** Action buttons only render for roles with the products:edit grant (the
   *  API enforces it regardless). */
  canEdit: boolean;
}

export default function ProductsTable({ products, canEdit }: ProductsTableProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ProductDTO | null>(null);

  async function handleDelete(product: ProductDTO) {
    setDeleting(product.id);
    try {
      const response = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        notifications.show({
          title: 'حذف انجام نشد',
          message: payload.error ?? 'خطایی رخ داد. دوباره تلاش کنید.',
          color: 'red',
        });
        return;
      }

      notifications.show({
        title: 'حذف شد',
        message: `«${product.name}» حذف شد.`,
        color: 'green',
      });
      setConfirmTarget(null);
      router.refresh();
    } catch {
      notifications.show({
        title: 'ارتباط برقرار نشد',
        message: 'اتصال خود را بررسی کنید.',
        color: 'red',
      });
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleVisibility(product: ProductDTO) {
    // Optimistic UI is skipped deliberately: server state is the truth and a
    // failed toggle would need a rollback anyway. The row stays until refresh.
    setDeleting(product.id);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: product.name,
          price: product.price,
          discountPercent: product.discountPercent,
          qty: product.qty,
          isVisible: !product.isVisible,
          props: product.props,
          variants: product.variants,
          images: product.images,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        notifications.show({
          title: 'تغییر انجام نشد',
          message: payload.error ?? 'خطایی رخ داد. دوباره تلاش کنید.',
          color: 'red',
        });
        return;
      }

      router.refresh();
    } catch {
      notifications.show({
        title: 'ارتباط برقرار نشد',
        message: 'اتصال خود را بررسی کنید.',
        color: 'red',
      });
    } finally {
      setDeleting(null);
    }
  }

  if (products.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        محصولی یافت نشد.
      </Text>
    );
  }

  function VisibilityBadge({ product }: { product: ProductDTO }) {
    return product.isVisible ? (
      <Badge variant="light" color="green" radius="sm" size="sm">
        نمایان
      </Badge>
    ) : (
      <Badge variant="light" color="gray" radius="sm" size="sm">
        پنهان
      </Badge>
    );
  }

  function Actions({ product }: { product: ProductDTO }) {
    if (!canEdit) {
      return null;
    }

    const busy = deleting === product.id;

    return (
      <Group gap="xs" wrap="nowrap">
        <Tooltip label="ویرایش">
          <Button
            component="a"
            href={`/products/${product.id}/edit`}
            variant="default"
            size="compact-sm"
            radius="md"
            aria-label={`ویرایش ${product.name}`}
            disabled={busy}
          >
            <IconPencil size={15} />
          </Button>
        </Tooltip>

        <Tooltip label={product.isVisible ? 'پنهان‌کردن' : 'نمایان‌کردن'}>
          <Button
            variant="default"
            size="compact-sm"
            radius="md"
            aria-label={
              product.isVisible ? `پنهان‌کردن ${product.name}` : `نمایان‌کردن ${product.name}`
            }
            onClick={() => handleToggleVisibility(product)}
            loading={busy}
          >
            {product.isVisible ? <IconEyeOff size={15} /> : <IconEye size={15} />}
          </Button>
        </Tooltip>

        <Tooltip label="حذف">
          <Button
            variant="light"
            color="red"
            size="compact-sm"
            radius="md"
            aria-label={`حذف ${product.name}`}
            onClick={() => setConfirmTarget(product)}
            disabled={busy}
          >
            <IconTrash size={15} />
          </Button>
        </Tooltip>
      </Group>
    );
  }

  /** Price cell body: the discounted price with the original struck through. */
  function PriceCell({ product }: { product: ProductDTO }) {
    return (
      <Group gap={6} wrap="nowrap" align="baseline">
        {product.discountPercent > 0 ? (
          <>
            <Badge variant="filled" color="red" radius="sm" size="sm">
              {enPercent(product.discountPercent, { fractionDigits: 0 })}
            </Badge>
            <Text size="xs" c="dimmed" td="line-through">
              {enCurrency(product.price, false)}
            </Text>
          </>
        ) : null}
        <Text size="sm" fw={600} className="mantine-Table-td numeric">
          {enCurrency(applyDiscount(product.price, product.discountPercent), false)}
        </Text>
      </Group>
    );
  }

  const thumb = (product: ProductDTO) =>
    product.images[0] ? (
      <Avatar
        src={`/api/files/${product.images[0].path}`}
        size={36}
        radius="md"
        alt={`تصویر ${product.name}`}
        mx="auto"
      />
    ) : (
      <Avatar size={36} radius="md" color="brand" alt="" />
    );

  return (
    <>
      {/* Desktop: a real table. */}
      <Box visibleFrom="sm">
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={52} />
              <Table.Th>نام محصول</Table.Th>
              <Table.Th>قیمت</Table.Th>
              <Table.Th>موجودی</Table.Th>
              <Table.Th>نوع‌ها</Table.Th>
              <Table.Th>نمایش</Table.Th>
              {canEdit ? <Table.Th>عملیات</Table.Th> : null}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {products.map((product) => (
              <Table.Tr key={product.id} opacity={product.isVisible ? 1 : 0.6}>
                <Table.Td>{thumb(product)}</Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500} lineClamp={1}>
                    {product.name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <PriceCell product={product} />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c={product.qty === 0 ? 'red' : undefined} fw={600}>
                    {product.qty === 0 ? 'ناموجود' : enNumber(product.qty)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {product.variants.length > 0 ? enNumber(product.variants.length) : '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <VisibilityBadge product={product} />
                </Table.Td>
                {canEdit ? (
                  <Table.Td>
                    <Actions product={product} />
                  </Table.Td>
                ) : null}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>

      {/* Mobile: one card per product, like the orders list. */}
      <Stack gap="sm" hiddenFrom="sm">
        {products.map((product) => (
          <Card key={product.id} padding="sm" radius="md" opacity={product.isVisible ? 1 : 0.6}>
            <Group wrap="nowrap" gap="sm" align="flex-start">
              {thumb(product)}
              <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <Text size="sm" fw={600} lineClamp={1}>
                    {product.name}
                  </Text>
                  <VisibilityBadge product={product} />
                </Group>
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <PriceCell product={product} />
                  <Text size="xs" c={product.qty === 0 ? 'red' : 'dimmed'}>
                    {product.qty === 0 ? 'ناموجود' : `موجودی: ${enNumber(product.qty)}`}
                  </Text>
                </Group>
              </Stack>
            </Group>
            {canEdit ? <Actions product={product} /> : null}
          </Card>
        ))}
      </Stack>

      <Modal
        opened={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        title="حذف محصول"
        centered
      >
        {confirmTarget ? (
          <Stack gap="md">
            <Alert variant="light" color="red">
              «{confirmTarget.name}» و همه نوع‌ها و تصاویر آن حذف می‌شود. این عمل بازگشت‌پذیر نیست.
            </Alert>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirmTarget(null)}>
                انصراف
              </Button>
              <Button
                color="red"
                loading={deleting === confirmTarget.id}
                onClick={() => handleDelete(confirmTarget)}
              >
                حذف
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </>
  );
}
