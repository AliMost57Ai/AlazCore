import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, Group, Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import PanelBackButton from '@/components/ui/panel/PanelBackButton';
import { requireSession } from '@/lib/auth';
import { getSupportTicket } from '@/lib/support-tickets';
import TenantTicketDetailClient from './TenantTicketDetailClient';

export const metadata: Metadata = {
  title: 'گفتگوی پشتیبانی AlazCore',
};

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

/**
 * صفحه اختصاصی گفتگوی مالک ↔ پشتیبان کور — قاعده پنل: هیچ گفتگویی مودال نیست.
 * کلیک روی ردیف /support به همین صفحه می‌آید؛ GET پراکسی سمت کور بازدید مالک
 * را هم خوانده می‌کند (بج نخوانده ویو مالک پاک می‌شود).
 */
export default async function TenantTicketDetailPage({ params }: PageProps) {
  await requireSession('/support');

  const { id } = await params;
  const ticket = await getSupportTicket(decodeURIComponent(id));
  if ('error' in ticket) {
    notFound();
  }

  return (
    <Stack gap="lg">
      <Group gap="xs" className="no-print">
        <PanelBackButton />
      </Group>

      <PageHeader
        title={ticket.subject}
        description={`تیکت ${ticket.displayId} — گفتگو با پشتیبانی آلازکور`}
      />

      <Card padding="lg" withBorder>
        <TenantTicketDetailClient initialTicket={JSON.parse(JSON.stringify(ticket))} />
      </Card>
    </Stack>
  );
}
