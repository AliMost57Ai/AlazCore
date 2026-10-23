import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Anchor, Breadcrumbs, Stack, Text } from '@mantine/core';
import CustomerFileView from '@/components/customers/CustomerFile';
import PageHeader from '@/components/layout/PageHeader';
import { canAccessCustomerFile, canAccessMenu, requireSession } from '@/lib/auth';
import { getCustomerFile } from '@/lib/customers';
import { faCurrency, faNumber } from '@/lib/format';

export const metadata: Metadata = {
  title: 'پروندهٔ مشتری',
};

export const dynamic = 'force-dynamic';

/**
 * The customer's full file: account, orders, wallet, gateway attempts,
 * tickets, burned coupons and addresses — everything that account left behind,
 * in one read-only page.
 *
 * Reachable by two different grants, which is why the guard is
 * `canAccessCustomerFile` rather than the /customers menu check: from the
 * customer list (grant '/customers') and from inside a support conversation
 * (grant '/customers/file'). proxy.ts applies the same rule through
 * ALTERNATE_GRANTS — see lib/nav-permissions.ts.
 */
export default async function CustomerFilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('/customers');

  if (!canAccessCustomerFile(session)) {
    redirect('/dashboard');
  }

  const { id } = await params;
  const file = await getCustomerFile(id);

  // Unknown id, or a staff account — either way there is no customer here.
  if (!file) {
    notFound();
  }

  // The way back has to be a page this session may actually open. A supporter
  // holds no /customers grant, so the list crumb would bounce them to the
  // dashboard; somebody holding only '/customers/file' has neither list, and
  // gets no crumb rather than a link that redirects.
  const backLink = canAccessMenu(session, '/customers')
    ? { href: '/customers', label: 'مشتریان' }
    : canAccessMenu(session, '/support')
      ? { href: '/support', label: 'تیکت‌های پشتیبانی' }
      : null;

  return (
    <Stack gap="lg">
      <Breadcrumbs>
        {backLink ? (
          <Anchor href={backLink.href} size="sm">
            {backLink.label}
          </Anchor>
        ) : null}
        <Text size="sm" c="dimmed">
          {file.name}
        </Text>
      </Breadcrumbs>

      <PageHeader
        title={`پروندهٔ ${file.name}`}
        description={`${faNumber(file.orderCount)} سفارش · مجموع خرید ${faCurrency(
          file.spent,
          false
        )} · عضویت از ${file.since}`}
      />

      <CustomerFileView file={file} canViewTickets={canAccessMenu(session, '/support')} />
    </Stack>
  );
}
