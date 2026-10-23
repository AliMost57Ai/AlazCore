import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Button, Card, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import OrdersTable from '@/components/dashboard/OrdersTable';
import PageHeader from '@/components/layout/PageHeader';
import ExportOrdersButton from '@/components/orders/ExportOrdersButton';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { faNumber } from '@/lib/format';
import { listOrders, STATUS_LABELS } from '@/lib/orders';

export const metadata: Metadata = {
  title: 'سفارش‌ها',
};

/**
 * Orders list. searchParams (Promise in Next 15+) drive the search box
 * (customer name, order id or phone) and the status filter — a native form
 * GET, same as the products page. The export button downloads exactly the
 * filtered rows.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await requireSession('/orders');
  // The API enforces this too; the redirect just avoids dead controls for staff
  // whose role was not granted this menu.
  if (!canAccessMenu(session, '/orders')) {
    redirect('/dashboard');
  }
  const { q, status } = await searchParams;
  const canEdit = canAccessMenu(session, '/orders', 'edit');

  const statusFilter = status && status in STATUS_LABELS && status !== 'all' ? status : undefined;
  const search = q?.trim() || undefined;
  const orders = await listOrders(undefined, {
    search,
    status: statusFilter,
  });

  // The export endpoint takes the same filters, so the workbook matches the table.
  const exportParams = new URLSearchParams();
  if (search) {
    exportParams.set('q', search);
  }
  if (statusFilter) {
    exportParams.set('status', statusFilter);
  }
  const exportHref = `/api/export/orders${
    exportParams.size > 0 ? `?${exportParams.toString()}` : ''
  }`;

  return (
    <Stack gap="lg">
      <PageHeader
        title="سفارش‌ها"
        description={`${faNumber(orders.length)} سفارش در بازه انتخاب‌شده`}
        actions={<ExportOrdersButton href={exportHref} />}
      />

      <Card>
        {/* Filter form stacks on mobile and sits in one row from xs up — the
            same shape as the products page filters. */}
        <form method="get" action="/orders">
          <Group gap="sm" mb="md" wrap="wrap">
            <TextInput
              name="q"
              defaultValue={q ?? ''}
              placeholder="جستجوی شناسه، نام مشتری یا موبایل…"
              size="sm"
              radius="md"
              aria-label="جستجوی سفارش"
              style={{ flex: '1 1 220px' }}
            />
            <Select
              name="status"
              data={[
                { value: 'all', label: 'همه وضعیت‌ها' },
                ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
              ]}
              defaultValue={status ?? 'all'}
              allowDeselect={false}
              size="sm"
              radius="md"
              aria-label="فیلتر وضعیت"
              w={{ base: '100%', xs: 180 }}
            />
            <Button type="submit" variant="default" size="sm" radius="md">
              جستجو
            </Button>
          </Group>
        </form>

        {orders.length === 0 ? (
          <Text size="sm" c="dimmed" py="xl" ta="center">
            سفارشی با این مشخصات یافت نشد.
          </Text>
        ) : (
          <OrdersTable orders={orders} canEdit={canEdit} />
        )}
      </Card>
    </Stack>
  );
}
