'use client';

import { useCallback, useState } from 'react';
import { notifications } from '@mantine/notifications';
import TicketConversation from '@/components/tickets/TicketConversation';
import type {
  GenericTicket,
  TicketAdapter,
  TicketRoleConfig,
} from '@/components/tickets/tickets-shared';

/**
 * کلاینت صفحه گفتگوی مالک↔کور — سمت درخواست‌کننده: وضعیت/بازگشایی با پشتیبان
 * کور است (قفل مرجع)، پیوست عکس ندارد و markRead/polling از GET پراکسی می‌آید.
 */
const ROLE: TicketRoleConfig = {
  viewerSide: 'tenant',
  selfLabel: 'شما (مالک فروشگاه)',
  otherLabel: 'پشتیبانی آلازکور',
  canManageStatus: false,
};

export default function TenantTicketDetailClient({
  initialTicket,
}: {
  initialTicket: GenericTicket;
}) {
  const [ticket, setTicket] = useState<GenericTicket>(initialTicket);

  const adapter: TicketAdapter = {
    async create() {
      return null;
    },
    async reply(id, body) {
      const response = await fetch(`/api/admin/support/tickets/${id}`, {
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
    // باز کردن صفحه = خواندن از سمت مالک (GET سمت کور ثبتش می‌کند).
    async markRead(id) {
      await fetch(`/api/admin/support/tickets/${id}`).catch(() => undefined);
    },
    // polling رشته گفتگو — پاسخ پشتیبان کور بدون رفرش دیده می‌شود.
    async refreshTicket(id) {
      try {
        const response = await fetch(`/api/admin/support/tickets/${id}`);
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
      const response = await fetch(`/api/admin/support/tickets/${ticket.id}`);
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
