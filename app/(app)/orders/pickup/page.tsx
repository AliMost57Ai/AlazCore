import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Select, Stack, TextInput } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import PickupDateFilter from '@/components/orders/PickupDateFilter';
import PickupOrdersTable from '@/components/orders/PickupOrdersTable';
import ListActions from '@/components/ui/panel/ListActions';
import ListFilterForm from '@/components/ui/panel/ListFilterForm';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { isInPersonDeliveryEnabled } from '@/lib/core-license';
import { enNumber } from '@/lib/format';
import { pickupOrdersList, type PickupOrderFilter } from '@/lib/pickup';

export const metadata: Metadata = {
  title: 'تحویل حضوری',
};

export const dynamic = 'force-dynamic';

const FILTERS: { value: PickupOrderFilter; label: string }[] = [
  { value: 'all', label: 'همه' },
  { value: 'today', label: 'تحویل امروز' },
  { value: 'upcoming', label: 'رزروهای پیش‌رو' },
  { value: 'delivered', label: 'تحویل‌شده' },
];

function isFilter(value: string | undefined): value is PickupOrderFilter {
  return value === 'today' || value === 'upcoming' || value === 'delivered' || value === 'all';
}

/**
 * لیست سفارش‌های تحویل حضوری — جستجوی کامل (شناسه/مشتری/موبایل/نقطه) و
 * فیلترها (امروز = فقط تحویل‌های امروز، پیش‌رو، تحویل‌شده). کاربر با دسترسی
 * وضعیت سفارش را به «تحویل شده» تغییر می‌دهد.
 */
export default async function PickupOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; date?: string }>;
}) {
  const session = await requireSession('/orders/pickup');
  if (!canAccessMenu(session, '/orders/pickup')) {
    redirect('/dashboard');
  }
  if (!(await isInPersonDeliveryEnabled())) {
    redirect('/dashboard');
  }

  const { filter, q, date } = await searchParams;
  const activeFilter: PickupOrderFilter = isFilter(filter) ? filter : 'all';
  const search = q?.trim() || undefined;
  const dateFilter = typeof date === 'string' ? date : '';
  const orders = await pickupOrdersList(activeFilter, search, dateFilter || undefined);
  const canDeliver = canAccessMenu(session, '/orders/pickup', 'edit');

  const exportParams = new URLSearchParams();
  if (activeFilter !== 'all') {
    exportParams.set('filter', activeFilter);
  }
  if (search) {
    exportParams.set('q', search);
  }
  if (dateFilter) {
    exportParams.set('date', dateFilter);
  }
  const exportHref = `/api/export/pickup${
    exportParams.size > 0 ? `?${exportParams.toString()}` : ''
  }`;
  const hasFilters = activeFilter !== 'all' || Boolean(search) || Boolean(dateFilter);

  return (
    <Stack gap="lg">
      <PageHeader
        title="تحویل حضوری"
        description={
          dateFilter
            ? `${enNumber(orders.length)} سفارش برای روز انتخابی`
            : `${enNumber(orders.length)} سفارش تحویل حضوری`
        }
        actions={<ListActions exportHref={exportHref} />}
      />

      <Card>
        <ListFilterForm action="/orders/pickup" hasFilters={hasFilters}>
          <TextInput
            name="q"
            defaultValue={q ?? ''}
            placeholder="جستجوی شناسه، نام کالا، مشتری، موبایل یا نقطه…"
            size="sm"
            radius="md"
            aria-label="جستجوی سفارش تحویل حضوری"
            style={{ flex: '1 1 220px' }}
          />
          <PickupDateFilter initial={dateFilter} />
          <Select
            name="filter"
            data={FILTERS}
            defaultValue={activeFilter}
            allowDeselect={false}
            size="sm"
            radius="md"
            aria-label="فیلتر وضعیت تحویل"
            w={{ base: '100%', xs: 190 }}
          />
        </ListFilterForm>

        <PickupOrdersTable orders={orders} canDeliver={canDeliver} />
      </Card>
    </Stack>
  );
}
