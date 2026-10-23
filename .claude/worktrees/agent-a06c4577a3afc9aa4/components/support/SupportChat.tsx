'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconAlertCircle,
  IconArrowRight,
  IconHeadset,
  IconPlus,
  IconSend,
} from '@tabler/icons-react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import PhoneInput from '@/components/ui/PhoneInput';
import type { SupportMessageDTO, SupportTicketDTO } from '@/lib/support';
import { TICKET_STATUS_COLORS, TICKET_STATUS_LABELS } from '@/lib/support-status';

export interface SupportChatProps {
  /** The signed-in customer's name — null means the visitor is a guest. */
  customerName: string | null;
  /** Greeting from تنظیمات ← پشتیبانی. */
  welcome: string;
  /** Notified whenever the requester's unread count changes (widget badge). */
  onUnreadChange?: (count: number) => void;
  /** Height of the message scroller. */
  height?: number;
}

type View = 'loading' | 'intro' | 'list' | 'thread' | 'new';

/** One message bubble — the requester's on one side, the supporter's on the other. */
function MessageBubble({ message }: { message: SupportMessageDTO }) {
  const mine = message.authorType === 'customer';
  return (
    <Box
      style={{
        display: 'flex',
        justifyContent: mine ? 'flex-start' : 'flex-end',
      }}
    >
      <Paper
        withBorder
        p="xs"
        radius="md"
        maw="85%"
        bg={mine ? undefined : 'var(--mantine-color-teal-0)'}
      >
        <Text size="xs" c="dimmed" mb={4}>
          {mine ? message.authorName : 'پشتیبان سایت'} — {message.date}
        </Text>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {message.body}
        </Text>
      </Paper>
    </Box>
  );
}

/**
 * The customer-facing support conversation, shared by the storefront chat
 * drawer (components/shop/SupportChatWidget.tsx) and /account/support.
 *
 * A guest must give a name and a mobile number before their first message —
 * the API hands back the capability cookie that then ties their visits to the
 * ticket, so later messages need no re-identification.
 */
export default function SupportChat({
  customerName,
  welcome,
  onUnreadChange,
  height = 320,
}: SupportChatProps) {
  const [view, setView] = useState<View>('loading');
  const [tickets, setTickets] = useState<SupportTicketDTO[]>([]);
  const [active, setActive] = useState<SupportTicketDTO | null>(null);
  const [messages, setMessages] = useState<SupportMessageDTO[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);

  // Guest identification (first message only).
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestBody, setGuestBody] = useState('');

  // New-ticket form (customers).
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');

  const scroller = useRef<HTMLDivElement>(null);

  const loadTickets = useCallback(async (): Promise<SupportTicketDTO[]> => {
    try {
      const response = await fetch('/api/support/tickets');
      if (!response.ok) {
        setError('بارگذاری گفتگوها ناموفق بود.');
        setView(customerName === null ? 'intro' : 'list');
        return [];
      }
      const payload = (await response.json()) as { tickets?: SupportTicketDTO[] };
      const list = payload.tickets ?? [];
      setTickets(list);
      onUnreadChange?.(list.filter((ticket) => ticket.unread).length);
      setView(list.length === 0 ? (customerName === null ? 'intro' : 'list') : 'list');
      return list;
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
      setView(customerName === null ? 'intro' : 'list');
      return [];
    }
  }, [customerName, onUnreadChange]);

  const openTicket = useCallback(async (ticket: SupportTicketDTO) => {
    setActive(ticket);
    setView('thread');
    setLoadingThread(true);
    setError(null);
    try {
      const response = await fetch(`/api/support/tickets/${ticket.id}`);
      const payload = (await response.json().catch(() => ({}))) as {
        ticket?: { messages: SupportMessageDTO[] };
        error?: string;
      };
      if (!response.ok || !payload.ticket) {
        setError(payload.error ?? 'گفتگو یافت نشد.');
        return;
      }
      setMessages(payload.ticket.messages);
      // Reading it clears this side's unread marker.
      setTickets((current) =>
        current.map((item) => (item.id === ticket.id ? { ...item, unread: false } : item))
      );
      onUnreadChange?.(0);
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoadingThread(false);
    }
  }, [onUnreadChange]);

  // First load.
  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  // Light polling while the conversation is on screen: 10s inside a thread so
  // a supporter's answer appears without a refresh, 30s on the list for the
  // unread indicator. No realtime infrastructure exists in this app, and this
  // is deliberately the cheapest thing that is still useful.
  useEffect(() => {
    if (view !== 'thread' && view !== 'list') {
      return undefined;
    }
    const period = view === 'thread' ? 10_000 : 30_000;
    const timer = setInterval(() => {
      if (view === 'thread' && active) {
        void (async () => {
          try {
            const response = await fetch(`/api/support/tickets/${active.id}`);
            if (!response.ok) {
              return;
            }
            const payload = (await response.json()) as {
              ticket?: { messages: SupportMessageDTO[]; status: string };
            };
            if (payload.ticket) {
              setMessages(payload.ticket.messages);
            }
          } catch {
            // A failed poll is not worth an error banner — the next one may work.
          }
        })();
      } else {
        void loadTickets();
      }
    }, period);
    return () => clearInterval(timer);
  }, [view, active, loadTickets]);

  // Keep the newest message in view.
  useEffect(() => {
    const node = scroller.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages]);

  /** Parses a response body, surfacing the Persian error the API sent. */
  async function readError(response: Response, fallback: string): Promise<string> {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return payload.error ?? fallback;
  }

  async function sendGuestMessage() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: guestName, phone: guestPhone, body: guestBody }),
      });
      if (!response.ok) {
        setError(await readError(response, 'ارسال پیام ناموفق بود.'));
        return;
      }
      setGuestBody('');
      setGuestName('');
      setGuestPhone('');
      // Land straight in the conversation the guest just opened.
      const list = await loadTickets();
      if (list[0]) {
        await openTicket(list[0]);
      }
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setSending(false);
    }
  }

  async function createTicket() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: newSubject, body: newBody }),
      });
      if (!response.ok) {
        setError(await readError(response, 'ثبت تیکت ناموفق بود.'));
        return;
      }
      setNewSubject('');
      setNewBody('');
      await loadTickets();
      setView('list');
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setSending(false);
    }
  }

  async function sendReply() {
    if (!active) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/support/tickets/${active.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft }),
      });
      if (!response.ok) {
        setError(await readError(response, 'ارسال پیام ناموفق بود.'));
        return;
      }
      setDraft('');
      await openTicket(active);
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setSending(false);
    }
  }

  /* ---------------------------------------------------------------- views */

  const banner = error ? (
    <Alert color="red" icon={<IconAlertCircle size={16} />} p="xs">
      <Text size="sm">{error}</Text>
    </Alert>
  ) : null;

  if (view === 'loading') {
    return (
      <Group justify="center" p="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  if (view === 'intro') {
    return (
      <Stack gap="sm">
        <Alert color="blue" icon={<IconHeadset size={16} />} p="xs">
          <Text size="sm">{welcome}</Text>
        </Alert>
        <Text size="xs" c="dimmed">
          برای شروع گفتگو، نام و شماره موبایل خود را وارد کنید تا پشتیبان بتواند پاسخ دهد.
        </Text>
        {banner}
        <TextInput
          label="نام و نام خانوادگی"
          value={guestName}
          onChange={(event) => setGuestName(event.currentTarget.value)}
          required
        />
        <PhoneInput
          label="شماره موبایل"
          value={guestPhone}
          onChange={(event) => setGuestPhone(event.currentTarget.value)}
          required
        />
        <Textarea
          label="پیام شما"
          placeholder="سؤال یا مشکل خود را بنویسید…"
          autosize
          minRows={3}
          maxLength={2000}
          value={guestBody}
          onChange={(event) => setGuestBody(event.currentTarget.value)}
          required
        />
        <Button
          onClick={() => void sendGuestMessage()}
          loading={sending}
          leftSection={<IconSend size={16} />}
          disabled={guestName.trim().length < 2 || guestPhone.length !== 11 || !guestBody.trim()}
        >
          ارسال پیام
        </Button>
      </Stack>
    );
  }

  if (view === 'new') {
    return (
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600} size="sm">
            تیکت جدید
          </Text>
          <Button
            variant="subtle"
            size="compact-sm"
            rightSection={<IconArrowRight size={14} />}
            onClick={() => {
              setError(null);
              setView('list');
            }}
          >
            بازگشت
          </Button>
        </Group>
        {banner}
        <TextInput
          label="موضوع"
          placeholder="مثلاً: پیگیری سفارش"
          maxLength={120}
          value={newSubject}
          onChange={(event) => setNewSubject(event.currentTarget.value)}
          required
        />
        <Textarea
          label="متن پیام"
          autosize
          minRows={4}
          maxLength={2000}
          value={newBody}
          onChange={(event) => setNewBody(event.currentTarget.value)}
          required
        />
        <Button
          onClick={() => void createTicket()}
          loading={sending}
          leftSection={<IconSend size={16} />}
          disabled={newSubject.trim().length < 2 || !newBody.trim()}
        >
          ارسال تیکت
        </Button>
      </Stack>
    );
  }

  if (view === 'thread' && active) {
    return (
      <Stack gap="sm" h="100%">
        <Group justify="space-between" wrap="nowrap">
          <Box style={{ minWidth: 0 }}>
            <Text fw={600} size="sm" truncate>
              {active.subject}
            </Text>
            <Text size="xs" c="dimmed">
              تیکت {active.displayId}
            </Text>
          </Box>
          <Button
            variant="subtle"
            size="compact-sm"
            rightSection={<IconArrowRight size={14} />}
            onClick={() => {
              setError(null);
              setActive(null);
              setMessages([]);
              void loadTickets();
            }}
          >
            بازگشت
          </Button>
        </Group>

        <Badge color={TICKET_STATUS_COLORS[active.status]} variant="light">
          {TICKET_STATUS_LABELS[active.status]}
        </Badge>
        {banner}

        <ScrollArea h={height} viewportRef={scroller} type="auto">
          <Stack gap="xs" p="xs">
            {loadingThread ? (
              <Group justify="center" p="md">
                <Loader size="sm" />
              </Group>
            ) : (
              messages.map((message) => <MessageBubble key={message.id} message={message} />)
            )}
          </Stack>
        </ScrollArea>

        {active.status === 'closed' ? (
          <Alert color="gray" p="xs">
            <Text size="sm">این تیکت بسته شده است — برای ادامه، تیکت تازه‌ای بسازید.</Text>
          </Alert>
        ) : (
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <Textarea
              placeholder="پاسخ خود را بنویسید…"
              autosize
              minRows={1}
              maxRows={4}
              maxLength={2000}
              style={{ flex: 1 }}
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
            />
            <ActionIcon
              size="lg"
              onClick={() => void sendReply()}
              loading={sending}
              disabled={!draft.trim()}
              aria-label="ارسال پاسخ"
            >
              <IconSend size={18} />
            </ActionIcon>
          </Group>
        )}
      </Stack>
    );
  }

  // list
  return (
    <Stack gap="sm">
      {banner}
      {tickets.length === 0 ? (
        <Alert color="blue" icon={<IconHeadset size={16} />} p="xs">
          <Text size="sm">{welcome}</Text>
        </Alert>
      ) : (
        <Stack gap="xs">
          {tickets.map((ticket) => (
            <UnstyledButton key={ticket.id} onClick={() => void openTicket(ticket)}>
              <Paper withBorder p="sm" radius="md">
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <Text size="sm" fw={600} truncate>
                    {ticket.subject}
                  </Text>
                  {ticket.unread ? <Badge color="red" size="xs" variant="filled" /> : null}
                </Group>
                <Group justify="space-between" mt={6} gap="xs">
                  <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
                    {ticket.lastMessage}
                  </Text>
                  <Badge size="xs" variant="light" color={TICKET_STATUS_COLORS[ticket.status]}>
                    {TICKET_STATUS_LABELS[ticket.status]}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  {ticket.displayId} — {ticket.lastMessageDate}
                </Text>
              </Paper>
            </UnstyledButton>
          ))}
        </Stack>
      )}

      {customerName !== null ? (
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            setError(null);
            setView('new');
          }}
        >
          تیکت جدید
        </Button>
      ) : null}
    </Stack>
  );
}
