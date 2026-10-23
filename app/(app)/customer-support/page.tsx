import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { listTicketsForStaff } from '@/lib/customer-tickets';
import OwnerCustomerTicketsClient from './OwnerCustomerTicketsClient';

export const metadata: Metadata = { title: 'پشتیبانی مشتریان' };

/** تیکتینگ مشتری↔مالک — سمت پشتیبان فروشگاه در داشبورد (رفتار نسخه مرجع). */
export default async function CustomerSupportPage() {
  const session = await requireSession('/customer-support');
  if (!canAccessMenu(session, '/customer-support')) {
    redirect('/dashboard');
  }

  const tickets = await listTicketsForStaff();

  return <OwnerCustomerTicketsClient initialTickets={JSON.parse(JSON.stringify(tickets))} />;
}
