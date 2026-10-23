import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { IconSearch, IconUsers } from '@tabler/icons-react';
import { Card, SimpleGrid, Stack, TextInput } from '@mantine/core';
import CustomerCard, { AddCustomerButton } from '@/components/customers/CustomerCard';
import EmptyState from '@/components/layout/EmptyState';
import PageHeader from '@/components/layout/PageHeader';
import ListActions from '@/components/ui/panel/ListActions';
import ListFilterForm from '@/components/ui/panel/ListFilterForm';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { listCustomers } from '@/lib/customers';
import { enNumber } from '@/lib/format';

export const metadata: Metadata = {
  title: 'مشتریان',
};

/**
 * Customers list. searchParams (Promise in Next 15+) drive the search box
 * (customer name or phone) — a native form GET, same as the products page.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession('/customers');
  // The API enforces this too; the redirect just avoids dead controls for staff
  // whose role was not granted this menu.
  if (!canAccessMenu(session, '/customers')) {
    redirect('/dashboard');
  }
  const { q } = await searchParams;
  const canEdit = canAccessMenu(session, '/customers', 'edit');
  const customers = await listCustomers(q);

  const hasFilters = Boolean(q);

  return (
    <Stack gap="lg">
      <PageHeader
        title="مشتریان"
        description={`${enNumber(customers.length)} مشتری ثبت‌نام‌شده در فروشگاه`}
        actions={<ListActions exportHref="/api/export/customers" print={false} />}
      />

      <Card className="no-print">
        <ListFilterForm action="/customers" hasFilters={hasFilters} actions={<AddCustomerButton />}>
          <TextInput
            name="q"
            defaultValue={q ?? ''}
            placeholder="جستجوی نام مشتری یا موبایل…"
            size="sm"
            radius="md"
            aria-label="جستجوی مشتری"
            style={{ flex: '1 1 220px' }}
          />
        </ListFilterForm>

        {customers.length === 0 && hasFilters ? (
          <EmptyState
            icon={IconSearch}
            message="مشتری‌ای با این مشخصات یافت نشد."
            hint="فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید."
          />
        ) : null}
      </Card>

      {customers.length === 0 && !hasFilters ? (
        <Card withBorder>
          <EmptyState
            icon={IconUsers}
            message="هنوز مشتری‌ای در فروشگاه ثبت‌نام نکرده است."
            hint="با اولین ثبت‌نام در فروشگاه، مشتری اینجا نمایش داده می‌شود."
          />
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={{ base: 'sm', sm: 'md' }}>
          {customers.map((customer) => (
            <CustomerCard key={customer.id} customer={customer} canEdit={canEdit} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
