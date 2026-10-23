'use client';

import { useCallback, useState } from 'react';
import { Card } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import TicketConversation from '@/components/tickets/TicketConversation';
import type { GenericTicket, TicketAdapter } from '@/components/tickets/tickets-shared';

const ROLE = {
  viewerSide: 'owner',
  selfLabel: 'پشتیبانی فروشگاه',
  otherLabel: 'مشتری',
  canManageStatus: true,
} as const;

/**
 * کلاینت صفحه گفتگو — همان adapterِ لیست پشتیبانی مشتریان (api/admin/tickets)
 * با پاسخ/وضعیت/بستن + markRead و polling رشته؛ پس از هر تغییر، تیکت از سرور
 * تازه می‌شود.
 */
export default function TicketDetailClient({ initialTicket }: { initialTicket: GenericTicket }) {
  const [ticket, setTicket] = useState<GenericTicket>(initialTicket);

  const adapter: TicketAdapter = {
    // تیکت را مشتری/مهمان می‌سازد — سمت پشتیبان ایجاد ندارد.
    async create() {
      return null;
    },
    async reply(id, body, imagePath) {
      const response = await fetch(`/api/admin/tickets/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, imagePath }),
      });
      return response.ok;
    },
    // پیوست عکس پاسخ پشتیبان — همان آپلود مشترک تیکت (JPG/PNG، ۲۰۰KB).
    async uploadImage(file) {
      const form = new FormData();
      form.set('file', file);
      try {
        const response = await fetch('/api/support/upload', { method: 'POST', body: form });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          notifications.show({
            title: 'خطا',
            message: data.error ?? 'آپلود تصویر ناموفق بود.',
            color: 'red',
          });
          return null;
        }
        const data = (await response.json()) as { path?: string };
        return data.path ?? null;
      } catch {
        notifications.show({ title: 'خطا', message: 'آپلود تصویر ناموفق بود.', color: 'red' });
        return null;
      }
    },
    async setStatus(id, status) {
      const response = await fetch(`/api/admin/tickets/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      return response.ok;
    },
    async close(id) {
      const response = await fetch(`/api/admin/tickets/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      });
      return response.ok;
    },
    // صفحه همین حالا باز است — GET سمت پشتیبان markRead می‌زند.
    async markRead(id) {
      await fetch(`/api/admin/tickets/${id}`).catch(() => undefined);
    },
    // polling رشته گفتگو (۱۰ ثانیه، visibility-gated داخل TicketConversation).
    async refreshTicket(id) {
      try {
        const response = await fetch(`/api/admin/tickets/${id}`);
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
      const response = await fetch(`/api/admin/tickets/${ticket.id}`);
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

  return (
    <Card padding="lg" withBorder>
      <TicketConversation ticket={ticket} role={ROLE} adapter={adapter} onChanged={reload} />
    </Card>
  );
}
