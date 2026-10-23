import { Anchor, Breadcrumbs, Card, Text } from '@mantine/core';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { requireSession } from '@/lib/auth';
import { getTicketFull, markTicketRead } from '@/lib/tickets';
import TicketDetailClient from './TicketDetailClient';

export const metadata = { title: 'گفتگوی تیکت' };

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

/**
 * صفحه اختصاصی گفتگوی یک تیکت — قاعده پنل: هیچ گفتگویی مودال نیست (آینه
 * app/(app)/customer-support/[id] نسخه فروشگاه؛ همگام‌سازی دستی). باز کردن صفحه
 * تیکت را برای پشتیبان کور خوانده می‌کند (بج نخوانده لیست و منو پاک می‌شود).
 */
export default async function TicketDetailPage({ params }: PageProps) {
  await requireSession();

  const { id } = await params;
  const ticket = await getTicketFull(decodeURIComponent(id));
  if (!ticket) {
    notFound();
  }

  await markTicketRead(ticket.id, 'core');

  return (
    <>
      <Breadcrumbs mb="sm">
        <Anchor href="/panel/tickets" size="sm">
          تیکت‌های پشتیبانی
        </Anchor>
        <Text size="sm" c="dimmed" ff="monospace">
          {ticket.displayId}
        </Text>
      </Breadcrumbs>

      <PageHeader
        title={ticket.subject}
        description={`تیکت ${ticket.displayId} — گفتگو با ${ticket.requesterName}${
          ticket.counterpart ? ` — دامنه ${ticket.counterpart}` : ''
        }`}
      />

      <Card padding="lg" withBorder mt="md">
        <TicketDetailClient initialTicket={JSON.parse(JSON.stringify(ticket))} />
      </Card>
    </>
  );
}
