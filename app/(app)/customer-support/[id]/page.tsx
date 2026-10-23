import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Grid, GridCol, Group, Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import CustomerContextPanel from '@/components/support/CustomerContextPanel';
import PanelBackButton from '@/components/ui/panel/PanelBackButton';
import { canAccessCustomerFile, requireSession } from '@/lib/auth';
import { getCustomerContext, getTicketForViewer, markTicketRead } from '@/lib/customer-tickets';
import TicketDetailClient from './TicketDetailClient';

export const metadata: Metadata = {
  title: 'گفتگوی تیکت',
};

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

/**
 * صفحه اختصاصی گفتگوی یک تیکت — قاعده پنل: جزئیات در موبایل صفحه باز می‌کند
 * نه مودال. کارت موبایل لیست پشتیبانی مشتریان به همین آدرس لینک است؛ دسکتاپ
 * همان مودال را دارد. باز کردن صفحه تیکت را برای پشتیبان خوانده می‌کند
 * (بج نخوانده لیست پاک می‌شود) و Context فقط-خواندنی کنار گفتگو می‌نشیند.
 */
export default async function TicketDetailPage({ params }: PageProps) {
  const session = await requireSession('/customer-support');

  const { id } = await params;
  const ticket = await getTicketForViewer(decodeURIComponent(id), { kind: 'staff' });
  if (!ticket) {
    notFound();
  }

  await markTicketRead(ticket.id, 'owner');

  const context = ticket.userId ? await getCustomerContext(ticket.userId) : null;
  const guest = ticket.isGuest
    ? { name: ticket.requesterName, phone: ticket.requesterPhone }
    : null;

  return (
    <Stack gap="lg">
      <Group gap="xs" className="no-print">
        <PanelBackButton />
      </Group>

      <PageHeader
        title={ticket.subject}
        description={`تیکت ${ticket.displayId} — گفتگو با ${ticket.requesterName}${guest ? ' (مهمان)' : ''}`}
      />

      {/* GridCol مستقیم import می‌شود: این یک Server Component است و static
          property (Grid.Col) روی client reference در دسترس نیست — الگوی dashboard. */}
      <Grid gutter="lg">
        <GridCol span={{ base: 12, md: 8 }}>
          <TicketDetailClient initialTicket={JSON.parse(JSON.stringify(ticket))} />
        </GridCol>
        <GridCol span={{ base: 12, md: 4 }}>
          <CustomerContextPanel
            context={context}
            guest={guest}
            canViewFile={canAccessCustomerFile(session)}
          />
        </GridCol>
      </Grid>
    </Stack>
  );
}
