import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Select, Stack, TextInput } from '@mantine/core';
import AccountingTable from '@/components/accounting/AccountingTable';
import PageHeader from '@/components/layout/PageHeader';
import ListActions from '@/components/ui/panel/ListActions';
import ListFilterForm from '@/components/ui/panel/ListFilterForm';
import { listOrderAccounts } from '@/lib/accounting';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { enCurrency, enNumber } from '@/lib/format';

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
  searchParams: Promise<{ q?: string; delivery?: string }>;
}) {
  const session = await requireSession('/accounting');

  // The API enforces this too; the redirect just avoids a dead page for staff
  // whose role was not granted this menu.
  if (!canAccessMenu(session, '/accounting')) {
    redirect('/dashboard');
  }

  const { q, delivery } = await searchParams;
  // فیلتر روش تحویل — «حضوری» فقط سفارش‌های تحویل حضوری رزروشده را می‌آورد.
  const deliveryFilter =
    delivery === 'pickup' ? 'pickup' : delivery === 'shipping' ? 'shipping' : 'all';
  const search = q?.trim() || undefined;
  const accounts = await listOrderAccounts(search, deliveryFilter);
  const settled = accounts.filter((account) => account.status !== 'pending');
  const settledTotal = settled.reduce((sum, account) => sum + account.payable, 0);
  const hasFilters = Boolean(search || deliveryFilter !== 'all');

  // خروجی اکسل با همان فیلترهای فعال صفحه.
  const exportParams = new URLSearchParams();
  if (search) {
    exportParams.set('q', search);
  }
  if (deliveryFilter !== 'all') {
    exportParams.set('delivery', deliveryFilter);
  }
  const exportHref = `/api/export/accounting${
    exportParams.size > 0 ? `?${exportParams.toString()}` : ''
  }`;

  return (
    <Stack gap="lg">
      <PageHeader
        title="حسابداری"
        description={`${enNumber(accounts.length)} سفارش — جمع پرداخت‌ها ${enCurrency(
          settledTotal,
          false
        )} تومان`}
        actions={<ListActions exportHref={exportHref} />}
      />

      <Card>
        <ListFilterForm action="/accounting" hasFilters={hasFilters}>
          <TextInput
            name="q"
            defaultValue={q ?? ''}
            placeholder="جستجوی شناسه سفارش، نام مشتری یا موبایل…"
            size="sm"
            radius="md"
            aria-label="جستجوی حساب سفارش"
            style={{ flex: '1 1 220px' }}
          />
          <Select
            name="delivery"
            data={[
              { value: 'all', label: 'همه روش‌های تحویل' },
              { value: 'pickup', label: 'تحویل حضوری' },
              { value: 'shipping', label: 'ارسالی' },
            ]}
            defaultValue={deliveryFilter}
            allowDeselect={false}
            size="sm"
            radius="md"
            aria-label="فیلتر روش تحویل"
            w={{ base: '100%', xs: 190 }}
          />
        </ListFilterForm>

        <AccountingTable accounts={accounts} filtered={hasFilters} />
      </Card>
    </Stack>
  );
}
