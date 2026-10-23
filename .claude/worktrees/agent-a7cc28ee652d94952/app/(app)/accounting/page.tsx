import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Button, Card, Group, Stack, Text, TextInput } from '@mantine/core';
import AccountingTable from '@/components/accounting/AccountingTable';
import PageHeader from '@/components/layout/PageHeader';
import { listOrderAccounts } from '@/lib/accounting';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { faCurrency, faNumber } from '@/lib/format';

export const metadata: Metadata = {
  title: 'حسابداری',
};

export const dynamic = 'force-dynamic';

/**
 * The admin accounting page: the money story of every account-tied order —
 * original price, product discount, coupon discount, the online (gateway)
 * portion, the wallet portion, and refunds. Searchable by order id or
 * customer name/phone via a native form GET, same as the orders page.
 */
export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession('/accounting');

  // The API enforces this too; the redirect just avoids a dead page for staff
  // whose role was not granted this menu.
  if (!canAccessMenu(session, '/accounting')) {
    redirect('/dashboard');
  }

  const { q } = await searchParams;
  const accounts = await listOrderAccounts(q);
  const settled = accounts.filter((account) => account.status !== 'pending');
  const settledTotal = settled.reduce((sum, account) => sum + account.payable, 0);

  return (
    <Stack gap="lg">
      <PageHeader
        title="حسابداری"
        description={`${faNumber(accounts.length)} سفارش — جمع پرداخت‌ها ${faCurrency(
          settledTotal,
          false
        )} تومان`}
      />

      <Card>
        {/* Filter form stacks on mobile and sits in one row from xs up — the
            same shape as the orders page filters. */}
        <form method="get" action="/accounting">
          <Group gap="sm" mb="md" wrap="wrap">
            <TextInput
              name="q"
              defaultValue={q ?? ''}
              placeholder="جستجوی شناسه سفارش، نام مشتری یا موبایل…"
              size="sm"
              radius="md"
              aria-label="جستجوی حساب سفارش"
              style={{ flex: '1 1 220px' }}
            />
            <Button type="submit" variant="default" size="sm" radius="md">
              جستجو
            </Button>
          </Group>
        </form>

        {accounts.length === 0 ? (
          <Text size="sm" c="dimmed" py="xl" ta="center">
            سفارشی با این مشخصات یافت نشد.
          </Text>
        ) : (
          <AccountingTable accounts={accounts} />
        )}
      </Card>
    </Stack>
  );
}
