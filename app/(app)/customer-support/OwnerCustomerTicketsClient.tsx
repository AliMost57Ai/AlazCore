'use client';

import { useCallback, useEffect, useState } from 'react';
import TicketsManager, {
  type GenericTicket,
  type TicketAdapter,
  type TicketRoleConfig,
} from '@/components/tickets/TicketsManager';

/** ساید پشتیبان — گفتگو مشتری/مهمان ↔ فروشگاه؛ پشتیبان پاسخ می‌دهد و وضعیت را مدیریت می‌کند. */

const ROLE: TicketRoleConfig = {
  viewerSide: 'owner',
  selfLabel: 'پشتیبانی فروشگاه',
  otherLabel: 'مشتری',
  canManageStatus: true,
};

export default function OwnerCustomerTicketsClient({
  initialTickets,
}: {
  initialTickets: GenericTicket[];
}) {
  const [tickets, setTickets] = useState<GenericTicket[] | null>(initialTickets);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tickets');
      const data = (await response.json()) as { tickets?: GenericTicket[]; error?: string };
      if (!response.ok) {
        setError(data.error ?? 'دریافت تیکت‌ها ناموفق بود.');
        return;
      }
      setTickets(data.tickets ?? []);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
          setError(data.error ?? 'آپلود تصویر ناموفق بود.');
          return null;
        }
        const data = (await response.json()) as { path?: string };
        return data.path ?? null;
      } catch {
        setError('آپلود تصویر ناموفق بود.');
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
    // باز کردن گفتگو از لیست = خواندن از سمت پشتیبان (بج نخوانده پاک می‌شود).
    async markRead(id) {
      await fetch(`/api/admin/tickets/${id}`).catch(() => undefined);
    },
    // polling گفتگو — همان GET؛ پاسخ تازه بدون رفرش دیده می‌شود.
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

  return (
    <TicketsManager
      title="پشتیبانی مشتریان"
      description="گفتگوی مشتریان و مهمان‌های فروشگاه با شما — پاسخ، بستن و بازگشایی تیکت"
      tickets={tickets}
      loading={loading}
      error={error}
      onReload={load}
      adapter={adapter}
      role={ROLE}
      canCreate={false}
      detailHrefBase="/customer-support"
      features={{ search: true, unreadOnly: true, autoRefreshMs: 20_000 }}
    />
  );
}
