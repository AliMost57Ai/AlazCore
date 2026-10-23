'use client';

import { useCallback, useEffect, useState } from 'react';
import TicketsManager, {
  type GenericTicket,
  type TicketAdapter,
  type TicketRoleConfig,
} from '@/components/tickets/TicketsManager';

/**
 * ساید tenant — گفتگو مالک فروشگاه ↔ پشتیبانان کور از پراکسی
 * /api/admin/support/tickets. مالک درخواست‌کننده است: وضعیت/بازگشایی با
 * پشتیبان کور است و تیکت بسته برای او قفل می‌شود (رفتار مرجع).
 */

const ROLE: TicketRoleConfig = {
  viewerSide: 'tenant',
  selfLabel: 'شما (مالک فروشگاه)',
  otherLabel: 'پشتیبانی آلازکور',
  canManageStatus: false,
};

export default function SupportClient() {
  const [tickets, setTickets] = useState<GenericTicket[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/support/tickets');
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
    async create({ subject, body }) {
      const response = await fetch('/api/admin/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) {
        setError(data.error ?? 'ثبت ناموفق بود.');
        return null;
      }
      return data.id ?? null;
    },
    async reply(id, body) {
      const response = await fetch(`/api/admin/support/tickets/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'ارسال پاسخ ناموفق بود.');
        return false;
      }
      return true;
    },
    // باز کردن گفتگو = خواندن از سمت مالک (بج نخوانده ویو او پاک می‌شود).
    async markRead(id) {
      await fetch(`/api/admin/support/tickets/${id}`).catch(() => undefined);
    },
    // polling گفتگو — پاسخ پشتیبان کور بدون رفرش دیده می‌شود.
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

  return (
    <TicketsManager
      title="پشتیبانی AlazCore"
      description="گفتگو با پشتیبانان سامانه Core — درخواست درگاه، ارتقای پلن و رفع اشکال"
      tickets={tickets}
      loading={loading}
      error={error}
      onReload={load}
      adapter={adapter}
      role={ROLE}
      detailHrefBase="/support"
      features={{ search: true, unreadOnly: true, autoRefreshMs: 20_000 }}
    />
  );
}
