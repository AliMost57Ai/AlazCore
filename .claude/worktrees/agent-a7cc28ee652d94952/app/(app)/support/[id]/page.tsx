import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Anchor, Breadcrumbs, Grid, GridCol, Stack, Text } from '@mantine/core';
import AutoRefresh from '@/components/support/AutoRefresh';
import CustomerContextPanel from '@/components/support/CustomerContextPanel';
import SupportThread from '@/components/support/SupportThread';
import { canAccessCustomerFile, canAccessMenu, requireSession } from '@/lib/auth';
import { getCustomerContext, getTicketForViewer, markTicketRead } from '@/lib/support';

export const metadata: Metadata = {
  title: 'گفتگوی پشتیبانی',
};

export const dynamic = 'force-dynamic';

/**
 * One support conversation, supporter side: the thread on one side and the
 * customer's latest order + wallet state on the other, so an answer can be
 * given with context. Everything in the context panel is read-only.
 *
 * Opening the ticket also marks it read for staff (lib/support), which is what
 * clears its «خوانده‌نشده» marker in the list.
 */
export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('/support');

  if (!canAccessMenu(session, '/support')) {
    redirect('/dashboard');
  }

  const { id } = await params;
  const ticket = await getTicketForViewer(id, { kind: 'staff' });
  if (!ticket) {
    notFound();
  }

  const context = ticket.userId ? await getCustomerContext(ticket.userId) : null;

  // Opening the thread is what "reading" means here, so the list's unread
  // marker clears. (The API route does the same for the customer side.)
  await markTicketRead(ticket.id, 'staff');

  return (
    <Stack gap="md">
      {/*
        The messages themselves poll inside SupportThread (10s); this slower
        tick is for the context panel beside it — a wallet balance or a new
        order that changed while the conversation was open.
      */}
      <AutoRefresh intervalMs={60_000} />

      <Breadcrumbs>
        <Anchor href="/support" size="sm">
          تیکت‌های پشتیبانی
        </Anchor>
        <Text size="sm" c="dimmed">
          {ticket.displayId}
        </Text>
      </Breadcrumbs>

      <Grid gutter="md">
        {/*
          GridCol (the named export), never Grid.Col: @mantine/core ships
          sideEffects: ["*.css"], so a bundler may drop the `Grid.Col = GridCol`
          property assignment in Grid.mjs and leave `Grid.Col` undefined at
          runtime — which renders as "Element type is invalid".
        */}
        <GridCol span={{ base: 12, lg: 8 }}>
          <SupportThread ticket={ticket} />
        </GridCol>
        <GridCol span={{ base: 12, lg: 4 }}>
          <CustomerContextPanel
            context={context}
            guest={
              ticket.isGuest ? { name: ticket.requesterName, phone: ticket.requesterPhone } : null
            }
            canViewFile={canAccessCustomerFile(session)}
          />
        </GridCol>
      </Grid>
    </Stack>
  );
}
