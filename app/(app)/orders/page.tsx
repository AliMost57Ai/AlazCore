import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Select, Stack, TextInput } from '@mantine/core';
import OrdersTable from '@/components/dashboard/OrdersTable';
import PageHeader from '@/components/layout/PageHeader';
import ListActions from '@/components/ui/panel/ListActions';
import ListFilterForm from '@/components/ui/panel/ListFilterForm';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { enNumber } from '@/lib/format';
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
  searchParams: Promise<{ q?: string; status?: string; oversell?: string }>;
}) {
  const session = await requireSession('/orders');
  // The API enforces this too; the redirect just avoids dead controls for staff
  // whose role was not granted this menu.
  if (!canAccessMenu(session, '/orders')) {
    redirect('/dashboard');
  }
  const { q, status, oversell } = await searchParams;
  const canEdit = canAccessMenu(session, '/orders', 'edit');

  const statusFilter = status && status in STATUS_LABELS && status !== 'all' ? status : undefined;
  const search = q?.trim() || undefined;
  const oversellFilter = oversell === 'yes';
  const orders = await listOrders(undefined, {
    search,
    status: statusFilter,
    oversell: oversellFilter ? 'yes' : undefined,
  });

  // «چیزی که پیدا نشد» دو داستان دارد: فیلتر تنگ است یا فروشگاه هنوز سفارشی
  // نداشته — پیام حالت خالی این دو را جدا می‌کند.
  const hasFilters = Boolean(search || statusFilter || oversellFilter);

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
        description={`${enNumber(orders.length)} سفارش یافت شد`}
        actions={<ListActions exportHref={exportHref} />}
      />

      <Card>
        <ListFilterForm action="/orders" hasFilters={hasFilters}>
          <TextInput
            name="q"
            defaultValue={q ?? ''}
            placeholder="جستجوی شناسه، نام کالا، مشتری یا موبایل…"
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
          <Select
            name="oversell"
            data={[
              { value: 'no', label: 'همه سفارش‌ها' },
              { value: 'yes', label: 'خالی‌فروشی' },
            ]}
            defaultValue={oversell === 'yes' ? 'yes' : 'no'}
            allowDeselect={false}
            size="sm"
            radius="md"
            aria-label="فیلتر خالی‌فروشی"
            w={{ base: '100%', xs: 150 }}
          />
        </ListFilterForm>

        <OrdersTable orders={orders} canEdit={canEdit} filtered={hasFilters} />
      </Card>
    </Stack>
  );
}
