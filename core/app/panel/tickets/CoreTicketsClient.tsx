'use client';

import { useCallback, useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';
import TicketsManager, {
  type GenericTicket,
  type TicketAdapter,
  type TicketRoleConfig,
} from '@/components/tickets/TicketsManager';

/**
 * ساید panel — گفتگو مالک فروشگاه ↔ پرسنل آلازکور روی APIهای پنل Core
 * (/api/tickets). سمت کور پشتیبان است: وضعیت/بازگشایی با اوست و باز کردن
 * گفتگو آن را خوانده می‌کند.
 */

const ROLE: TicketRoleConfig = {
  viewerSide: 'core',
  selfLabel: 'پشتیبان آلازکور',
  otherLabel: 'مالک فروشگاه',
  canManageStatus: true,
};

export default function CoreTicketsClient({
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
      const response = await fetch('/api/tickets');
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
    // تیکت را مالک می‌سازد — ثبت از طرف مالک توسط پشتیبان ممکن است.
    async create({ subject, body }) {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) {
        notifications.show({ title: 'خطا', message: data.error ?? 'ثبت ناموفق بود.', color: 'red' });
        return null;
      }
      return data.id ?? null;
    },
    async reply(id, body) {
      const response = await fetch(`/api/tickets/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        notifications.show({ title: 'خطا', message: data.error ?? 'ارسال پاسخ ناموفق بود.', color: 'red' });
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
    // باز کردن گفتگو = خواندن از سمت کور (بج نخوانده پاک می‌شود).
    async markRead(id) {
      await fetch(`/api/tickets/${id}`).catch(() => undefined);
    },
    // polling گفتگو — همان GET.
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

  return (
    <TicketsManager
      title="تیکت‌های پشتیبانی"
      description="گفتگو مالکان فروشگاه با پرسنل پشتیبانی آلازکور"
      tickets={tickets}
      loading={loading}
      error={error}
      onReload={load}
      adapter={adapter}
      role={ROLE}
      showCounterpart
      createLabel="ثبت تیکت از طرف مالک"
      detailHrefBase="/panel/tickets"
    />
  );
}
