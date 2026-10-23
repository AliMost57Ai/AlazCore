import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import OnlinePaymentsTable from '@/components/payments/OnlinePaymentsTable';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { faNumber } from '@/lib/format';
import { listAllOnlinePayments } from '@/lib/wallet';

export const metadata: Metadata = {
  title: 'تراکنشهای درگاه',
};

export const dynamic = 'force-dynamic';

/**
 * The admin online-payments list: every payment attempt across all customers
 * (wallet charges and order payments) with its state — pending, verified, or
 * failed — mirroring what the customer sees under /account/wallet.
 */
export default async function PaymentsPage() {
  const session = await requireSession('/payments');

  // The API enforces this too; the redirect just avoids a dead page for staff
  // whose role was not granted this menu.
  if (!canAccessMenu(session, '/payments')) {
    redirect('/dashboard');
  }

  const payments = await listAllOnlinePayments();
  const verified = payments.filter((payment) => payment.state === 'verified').length;

  return (
    <>
      <PageHeader
        title="تراکنشهای درگاه"
        description={`${faNumber(payments.length)} تلاش — ${faNumber(verified)} موفق`}
      />
      <Card>
        <OnlinePaymentsTable payments={payments} />
      </Card>
    </>
  );
}
