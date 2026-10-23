'use client';

import { useCallback, useState } from 'react';
import { notifications } from '@mantine/notifications';
import TicketConversation from '@/components/tickets/TicketConversation';
import type { GenericTicket, TicketAdapter, TicketRoleConfig } from '@/components/tickets/tickets-shared';

const ROLE: TicketRoleConfig = {
  viewerSide: 'core',
  selfLabel: 'پشتیبان آلازکور',
  otherLabel: 'مالک فروشگاه',
  canManageStatus: true,
};

/**
 * کلاینت صفحه گفتگو سمت کور — همان adapterِ لیست تیکت‌ها (/api/tickets) با
 * پاسخ/وضعیت/بستن/بازگشایی + markRead و polling رشته؛ پس از هر تغییر، تیکت از
 * سرور تازه می‌شود. پیوست عکس ندارد (اسکیمای کور imagePath ندارد).
 */
export default function TicketDetailClient({ initialTicket }: { initialTicket: GenericTicket }) {
  const [ticket, setTicket] = useState<GenericTicket>(initialTicket);

  const adapter: TicketAdapter = {
    // تیکت را مالک می‌سازد — «ثبت از طرف مالک» از لیست انجام می‌شود.
    async create() {
      return null;
    },
    async reply(id, body) {
      const response = await fetch(`/api/tickets/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        notifications.show({
          title: 'خطا',
          message: data.error ?? 'ارسال پاسخ ناموفق بود.',
          color: 'red',
        });
        return false;
      }
      return true;
    },
    async setStatus(id, status) {
      const response = await fetch(`/api/tickets/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      return response.ok;
    },
    // صفحه همین حالا باز است — GET سمت کور markRead می‌زند.
    async markRead(id) {
      await fetch(`/api/tickets/${id}`).catch(() => undefined);
    },
    // polling رشته گفتگو (۱۰ ثانیه، visibility-gated داخل TicketConversation).
    async refreshTicket(id) {
      try {
        const response = await fetch(`/api/tickets/${id}`);
        if (!response.ok) {
          return null;
        }
        const data = (await response.json()) as { ticket?: GenericTicket };
        return data.ticket ?? null;
      } catch {
        return null;
      }
    },
  };

  const reload = useCallback(async () => {
    try {
      const response = await fetch(`/api/tickets/${ticket.id}`);
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { ticket?: GenericTicket };
      if (data.ticket) {
        setTicket(data.ticket);
      }
    } catch {
      // تلاش بعدی بعد از تغییر بعدی — گفتگو با نسخه فعلی ادامه می‌یابد.
    }
  }, [ticket.id]);

  return <TicketConversation ticket={ticket} role={ROLE} adapter={adapter} onChanged={reload} />;
}
