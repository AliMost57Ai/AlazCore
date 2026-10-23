import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import AutoRefresh from '@/components/support/AutoRefresh';
import SupportTicketsTable from '@/components/support/SupportTicketsTable';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { faNumber } from '@/lib/format';
import { countTicketsForAdmin, countUnreadForStaff, listTicketsForAdmin } from '@/lib/support';
import type { SupportTicketStatus } from '@/lib/support-status';

export const metadata: Metadata = {
  title: 'تیکت‌های پشتیبانی',
};

/**
 * Support → تیکت‌های پشتیبانی: every customer/guest conversation, newest
 * activity first, filterable by status, unread and free text. Opening a ticket
 * shows the thread next to the customer's latest order and wallet state.
 */
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; unread?: string; q?: string; page?: string }>;
}) {
  const session = await requireSession('/support');

  // The API enforces this too; the redirect just avoids dead controls for staff
  // whose role was not granted this menu.
  if (!canAccessMenu(session, '/support')) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const status =
    params.status === 'open' || params.status === 'answered' || params.status === 'closed'
      ? (params.status as SupportTicketStatus)
      : ('all' as const);
  const page = Number.parseInt(params.page ?? '1', 10);
  const filters = {
    status,
    unreadOnly: params.unread === '1',
    q: params.q?.trim() || undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };

  const [result, total, unread] = await Promise.all([
    listTicketsForAdmin(filters),
    countTicketsForAdmin(filters),
    countUnreadForStaff(),
  ]);

  return (
    <Stack gap="lg">
      {/*
        A new question is written from the storefront, so this list has to come
        to the supporter on its own — the filters and paging live in the URL, so
        a refresh re-reads exactly the same view.
      */}
      <AutoRefresh intervalMs={20_000} />

      <PageHeader
        title="تیکت‌های پشتیبانی"
        description={
          unread > 0
            ? `${faNumber(unread)} تیکت در انتظار پاسخ شماست.`
            : 'همهٔ تیکت‌ها پاسخ داده شده‌اند.'
        }
      />
      <SupportTicketsTable
        tickets={result.tickets}
        page={result.page}
        hasMore={result.hasMore}
        total={total}
        filters={{
          status,
          unread: filters.unreadOnly,
          q: params.q ?? '',
        }}
      />
    </Stack>
  );
}
