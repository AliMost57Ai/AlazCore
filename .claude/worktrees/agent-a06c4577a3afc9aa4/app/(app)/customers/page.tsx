import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Anchor, Button, Card, Group, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import CustomerCard, { AddCustomerButton } from '@/components/customers/CustomerCard';
import PageHeader from '@/components/layout/PageHeader';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { listCustomers } from '@/lib/customers';
import { faNumber } from '@/lib/format';

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

  return (
    <Stack gap="lg">
      <PageHeader
        title="مشتریان"
        description={`${faNumber(customers.length)} مشتری ثبت‌نام‌شده در فروشگاه`}
        actions={<AddCustomerButton />}
      />

      <Card>
        <form method="get" action="/customers">
          <Group gap="sm" mb="md" wrap="wrap">
            <TextInput
              name="q"
              defaultValue={q ?? ''}
              placeholder="جستجوی نام مشتری یا موبایل…"
              size="sm"
              radius="md"
              aria-label="جستجوی مشتری"
              style={{ flex: '1 1 220px' }}
            />
            <Button type="submit" variant="default" size="sm" radius="md">
              جستجو
            </Button>
          </Group>
        </form>

        {customers.length === 0 ? (
          <Text size="sm" c="dimmed" py="xl" ta="center">
            مشتری‌ای با این مشخصات یافت نشد.
          </Text>
        ) : null}
      </Card>

      {customers.length === 0 && !q ? (
        <Card withBorder>
          <Text size="sm" c="dimmed" py="xl" ta="center">
            هنوز مشتری‌ای در فروشگاه ثبت‌نام نکرده است. با اولین ثبت‌نام مشتری در{' '}
            <Anchor href="/" c="brand">
              فروشگاه
            </Anchor>{' '}
            اینجا نمایش داده می‌شود.
          </Text>
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
