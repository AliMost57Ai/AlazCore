import { requireSession } from '@/lib/auth';
import { listTicketsForCore } from '@/lib/tickets';
import CoreTicketsClient from './CoreTicketsClient';

export const metadata = { title: 'تیکت‌های پشتیبانی' };

export default async function TicketsPage() {
  await requireSession();

  const tickets = await listTicketsForCore();

  return <CoreTicketsClient initialTickets={JSON.parse(JSON.stringify(tickets))} />;
}
