'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconAlertCircle,
  IconCircleCheck,
  IconLock,
  IconLockOpen,
  IconSend,
} from '@tabler/icons-react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { SupportMessageDTO, SupportTicketDetailDTO } from '@/lib/support';
import { TICKET_STATUS_COLORS, TICKET_STATUS_LABELS } from '@/lib/support-status';

export interface SupportThreadProps {
  ticket: SupportTicketDetailDTO;
}

/**
 * One conversation, supporter side: the whole thread, a reply box, and the
 * close/reopen action. Messages are re-read from the server after every write
 * — and on a timer while the page is open, so a customer's follow-up question
 * appears without the supporter refreshing anything.
 */
export default function SupportThread({ ticket }: SupportThreadProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<SupportMessageDTO[]>(ticket.messages);
  const [status, setStatus] = useState(ticket.status);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    const response = await fetch(`/api/support/tickets/${ticket.id}`);
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { ticket?: SupportTicketDetailDTO };
    if (payload.ticket) {
      setMessages(payload.ticket.messages);
      setStatus(payload.ticket.status);
    }
  }, [ticket.id]);

  // Same cadence the storefront chat uses inside a thread (SupportChat.tsx).
  // A failed poll is not worth an error banner — the next one may well succeed.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void reload();
      }
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  // Keep the newest message in view when the thread grows below the fold.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/support/tickets/${ticket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? 'ارسال پاسخ ناموفق بود.');
        return;
      }
      setDraft('');
      await reload();
      // The list's unread badge depends on this thread — refresh it too.
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(next: 'open' | 'closed') {
    setError(null);
    try {
      const response = await fetch(`/api/support/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? 'تغییر وضعیت تیکت ناموفق بود.');
        return;
      }
      setStatus(next);
      notifications.show({
        title: 'انجام شد',
        message: next === 'closed' ? 'تیکت بسته شد.' : 'تیکت باز شد.',
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    }
  }

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Box style={{ minWidth: 0 }}>
            <Text fw={600} lineClamp={1}>
              {ticket.subject}
            </Text>
            <Text size="xs" c="dimmed">
              تیکت {ticket.displayId} — {ticket.requesterName}
              {ticket.isGuest ? ' (مهمان)' : ''}
            </Text>
          </Box>
          <Group gap="xs" wrap="nowrap">
            <Badge variant="light" color={TICKET_STATUS_COLORS[status]}>
              {TICKET_STATUS_LABELS[status]}
            </Badge>
            {status === 'closed' ? (
              <Button
                size="compact-sm"
                variant="light"
                leftSection={<IconLockOpen size={14} />}
                onClick={() => void changeStatus('open')}
              >
                بازکردن تیکت
              </Button>
            ) : (
              <Button
                size="compact-sm"
                variant="default"
                leftSection={<IconLock size={14} />}
                onClick={() => void changeStatus('closed')}
              >
                بستن تیکت
              </Button>
            )}
          </Group>
        </Group>

        {error ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />} p="xs">
            <Text size="sm">{error}</Text>
          </Alert>
        ) : null}

        <Stack gap="xs" mah={460} style={{ overflowY: 'auto' }} p="xs">
          {messages.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              پیامی در این تیکت ثبت نشده است.
            </Text>
          ) : (
            messages.map((message) => {
              const fromStaff = message.authorType === 'staff';
              return (
                <Box
                  key={message.id}
                  style={{ display: 'flex', justifyContent: fromStaff ? 'flex-end' : 'flex-start' }}
                >
                  <Paper
                    withBorder
                    p="xs"
                    radius="md"
                    maw="80%"
                    bg={fromStaff ? 'var(--mantine-color-teal-0)' : undefined}
                  >
                    <Text size="xs" c="dimmed" mb={4}>
                      {fromStaff ? `پشتیبان — ${message.authorName}` : message.authorName} —{' '}
                      {message.date}
                    </Text>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                      {message.body}
                    </Text>
                  </Paper>
                </Box>
              );
            })
          )}
          {/* Zero-height marker the auto-scroll effect targets. */}
          <div ref={bottomRef} />
        </Stack>

        {status === 'closed' ? (
          <Alert color="gray" p="xs">
            <Text size="sm">این تیکت بسته است — برای پاسخ‌دادن، ابتدا آن را باز کنید.</Text>
          </Alert>
        ) : (
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <Textarea
              placeholder="پاسخ خود را بنویسید…"
              autosize
              minRows={2}
              maxRows={6}
              maxLength={2000}
              style={{ flex: 1 }}
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
            />
            <ActionIcon
              size="lg"
              loading={sending}
              disabled={!draft.trim()}
              onClick={() => void send()}
              aria-label="ارسال پاسخ"
            >
              <IconSend size={18} />
            </ActionIcon>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
