'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { faDateTime } from '@/lib/format';
import { TICKET_STATUS_COLORS, TICKET_STATUS_LABELS } from '@/lib/ticket-status';
import type {
  GenericTicket,
  GenericTicketMessage,
  TicketAdapter,
  TicketRoleConfig,
} from './tickets-shared';

export interface TicketConversationProps {
  ticket: GenericTicket;
  role: TicketRoleConfig;
  adapter: TicketAdapter;
  /** پس از هر تغییر موفق (پاسخ/وضعیت) — caller داده را تازه می‌کند. */
  onChanged: () => void | Promise<void>;
}

/**
 * گفتگوی دوطرفه تیکت سمت کور — آینه components/tickets/TicketConversation.tsx
 * نسخه فروشگاه (همگام‌سازی دستی) بدون پیوست عکس: اسکیمای TicketMessage کور
 * ستون imagePath ندارد؛ اگر روزی پیوست به کور آمد، پورت نسخه فروشگاه مرجع است.
 *
 * واژه‌نامه مرجع: بازکردن گفتگو برای بیننده markRead می‌زند (بج نخوانده همان
 * سمت پاک می‌شود)، گفتگو هر ۱۰ ثانیه visibility-gated تازه می‌شود و تیکت بسته
 * قفل است — مالک فقط اعلان می‌بیند و پشتیبان باید صریحاً بازگشایی کند.
 */
export default function TicketConversation({
  ticket,
  role,
  adapter,
  onChanged,
}: TicketConversationProps) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(ticket);

  // داده تازه از والد (رکورد کامل صفحه یا هر reload بعد از پاسخ) state محلی را
  // به‌روز می‌کند و برای بیننده markRead می‌زند — نوشتن مجدد timestamp آیدمپوتنت است.
  useEffect(() => {
    setLive(ticket);
    if (adapter.markRead) {
      void adapter.markRead(ticket.id);
    }
  }, [ticket, adapter.markRead]);

  // polling ۱۰ ثانیه‌ای گفتگو — پاسخ تازه بدون رفرش دیده می‌شود.
  useEffect(() => {
    if (!adapter.refreshTicket) {
      return undefined;
    }
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void adapter.refreshTicket?.(live.id).then((fresh) => {
        if (fresh) {
          setLive(fresh);
        }
      });
    }, 10_000);
    return () => clearInterval(timer);
  }, [adapter, live.id]);

  function sideOf(message: GenericTicketMessage): 'self' | 'other' {
    return message.authorSide === role.viewerSide ? 'self' : 'other';
  }

  async function submitReply() {
    if (!reply.trim()) {
      return;
    }
    setBusy(true);
    try {
      const ok = await adapter.reply(live.id, reply.trim());
      if (!ok) {
        notifications.show({ title: 'خطا', message: 'ارسال پاسخ ناموفق بود.', color: 'red' });
        return;
      }
      setReply('');
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: string) {
    if (!adapter.setStatus) {
      return;
    }
    setBusy(true);
    try {
      const ok = await adapter.setStatus(live.id, status);
      if (!ok) {
        notifications.show({ title: 'خطا', message: 'تغییر وضعیت ناموفق بود.', color: 'red' });
        return;
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  const closed = live.status === 'closed';
  const isSupporter = role.canManageStatus;

  return (
    <Stack gap="md">
      <Group gap="xs" wrap="wrap">
        <Text size="xs" ff="monospace" style={{ direction: 'ltr' }}>
          {live.displayId}
        </Text>
        <Badge variant="light" color={TICKET_STATUS_COLORS[live.status as keyof typeof TICKET_STATUS_COLORS]}>
          {TICKET_STATUS_LABELS[live.status as keyof typeof TICKET_STATUS_LABELS] ?? live.status}
        </Badge>
        <Text size="xs" c="dimmed" style={{ marginLeft: 'auto' }}>
          {faDateTime(new Date(live.createdAt))}
        </Text>
      </Group>

      <Stack gap="sm" mih={240}>
        {(live.messages ?? []).map((message) => {
          const side = sideOf(message);
          return (
            <Paper
              key={message.id}
              p="sm"
              radius="md"
              withBorder
              style={{
                alignSelf: side === 'self' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background:
                  side === 'self'
                    ? 'var(--mantine-color-brand-light)'
                    : 'var(--mantine-color-default)',
              }}
            >
              <Text size="xs" c="dimmed" mb={4}>
                {side === 'self' ? role.selfLabel : role.otherLabel} ·{' '}
                {faDateTime(new Date(message.createdAt))}
              </Text>
              {message.body ? (
                <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {message.body}
                </Text>
              ) : null}
            </Paper>
          );
        })}
      </Stack>

      {closed ? (
        <Stack gap="sm">
          {isSupporter ? (
            <Button
              size="xs"
              variant="light"
              color="brand"
              disabled={busy}
              onClick={() => void changeStatus('open')}
              style={{ alignSelf: 'flex-start' }}
            >
              بازگشایی تیکت
            </Button>
          ) : (
            <Text size="xs" c="dimmed" ta="center">
              این تیکت بسته شده است — برای ادامه، تیکت تازه‌ای بسازید.
            </Text>
          )}
        </Stack>
      ) : (
        <>
          <Textarea
            label="پیام"
            autosize
            minRows={3}
            maxLength={2000}
            value={reply}
            onChange={(e) => setReply(e.currentTarget.value)}
            placeholder="پیام خود را بنویسید…"
          />
          <Group justify="space-between">
            {isSupporter && adapter.setStatus ? (
              <Button
                size="xs"
                variant="light"
                color="gray"
                disabled={busy}
                onClick={() => void changeStatus('closed')}
              >
                بستن تیکت
              </Button>
            ) : (
              <span />
            )}
            <Button
              loading={busy}
              disabled={!reply.trim()}
              onClick={() => void submitReply()}
            >
              ارسال
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}
