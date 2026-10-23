'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconAlertCircle,
  IconArrowRight,
  IconHeadset,
  IconPaperclip,
  IconPlus,
  IconSend,
  IconX,
} from '@tabler/icons-react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Image,
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
import type { SupportMessageDTO, SupportTicketDTO } from '@/lib/customer-tickets';
import { TICKET_STATUS_COLORS, TICKET_STATUS_LABELS } from '@/lib/ticket-status';

/** سقف انتخاب کلاینت — سرور با جادوی بایت‌ها دوباره چک می‌کند؛ این فقط UX است. */
const MAX_IMAGE_BYTES = 200 * 1024;

export interface SupportChatProps {
  /** نام مشتری واردشده — null یعنی بازدیدکننده مهمان است. */
  customerName: string | null;
  /** خوش‌آمد از تنظیمات ← پشتیبانی. */
  welcome: string;
  /** با هر تغییر شمار نخواندهٔ درخواست‌کننده خبر می‌دهد (بج ویجت). */
  onUnreadChange?: (count: number) => void;
  /** ارتفاع اسکرولر پیام‌ها. */
  height?: number;
}

type View = 'loading' | 'intro' | 'list' | 'thread' | 'new';

/** یک حباب پیام — درخواست‌کننده یک سمت، پشتیبان سمت دیگر؛ پیوست عکس اختیاری. */
function MessageBubble({ message }: { message: SupportMessageDTO }) {
  const mine = message.authorSide === 'customer';
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
        bg={mine ? undefined : 'var(--mantine-color-brand-light)'}
      >
        <Text size="xs" c="dimmed" mb={4}>
          {mine ? message.authorName : 'پشتیبان فروشگاه'} — {message.date}
        </Text>
        {message.body ? (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {message.body}
          </Text>
        ) : null}
        {message.imagePath ? (
          <Image
            mt={message.body ? 6 : 0}
            src={`/api/files/${message.imagePath}`}
            alt="تصویر پیوست"
            maw={260}
            mah={200}
            fit="contain"
            radius="sm"
            onClick={() => window.open(`/api/files/${message.imagePath}`, '_blank')}
            style={{ cursor: 'zoom-in' }}
          />
        ) : null}
      </Paper>
    </Box>
  );
}

/**
 * گفتگوی پشتیبانی سمت مشتری — مشترک بین کشوی چت فروشگاه
 * (components/shop/SupportChatWidget.tsx) و /account/support.
 *
 * مهمان قبل از اولین پیام باید نام و موبایل بدهد — API کوکی قابلیتی برمی‌گرداند
 * که بازدیدهای بعدی‌اش را به همان تیکت وصل می‌کند، پس پیام‌های بعدی بدون
 * شناسایی دوباره ارسال می‌شوند.
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
  const [attach, setAttach] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // پیش‌نمایش محلی تصویر انتخاب‌شده — هرگز آپلود نمی‌شود تا ارسال.
  useEffect(() => {
    if (!attach) {
      setAttachPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(attach);
    setAttachPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [attach]);

  // شناسایی مهمان (فقط اولین پیام).
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestBody, setGuestBody] = useState('');

  // فرم تیکت جدید (مشتری).
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

  const openTicket = useCallback(
    async (ticket: SupportTicketDTO) => {
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
        // خواندنش بج نخوانده همین سمت را پاک می‌کند.
        setTickets((current) =>
          current.map((item) => (item.id === ticket.id ? { ...item, unread: false } : item))
        );
        onUnreadChange?.(0);
      } catch {
        setError('ارتباط با سرور برقرار نشد.');
      } finally {
        setLoadingThread(false);
      }
    },
    [onUnreadChange]
  );

  // بار اول.
  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  // polling سبک وقتی گفتگو روی صفحه است: ۱۰ ثانیه داخل رشته تا پاسخ پشتیبان
  // بدون رفرش دیده شود، ۳۰ ثانیه روی لیست برای بج نخوانده. زیرساخت realtime
  // در این اپ وجود ندارد و این عمداً ارزان‌ترین چیزِ هنوز مفید است.
  useEffect(() => {
    if (view !== 'thread' && view !== 'list') {
      return undefined;
    }
    const period = view === 'thread' ? 10_000 : 30_000;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (view === 'thread' && active) {
        void (async () => {
          try {
            const response = await fetch(`/api/support/tickets/${active.id}`);
            if (!response.ok) {
              return;
            }
            const payload = (await response.json()) as {
              ticket?: { messages: SupportMessageDTO[] };
            };
            if (payload.ticket) {
              setMessages(payload.ticket.messages);
            }
          } catch {
            // شکست یک poll ارزش بنر خطا ندارد — بعدی شاید برسد.
          }
        })();
      } else {
        void loadTickets();
      }
    }, period);
    return () => clearInterval(timer);
  }, [view, active, loadTickets]);

  // تازه‌ترین پیام در دید بماند.
  useEffect(() => {
    const node = scroller.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages]);

  /** بدنه پاسخ را می‌خواند و خطای فارسی سرور را بیرون می‌دهد. */
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
      // مستقیم داخل گفتگویی که مهمان باز کرد فرود می‌آید.
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
    const hasText = draft.trim().length > 0;
    if (!hasText && !attach) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      let imagePath: string | undefined;
      if (attach) {
        const form = new FormData();
        form.set('file', attach);
        const upload = await fetch('/api/support/upload', { method: 'POST', body: form });
        if (!upload.ok) {
          setError(await readError(upload, 'آپلود تصویر ناموفق بود.'));
          return;
        }
        const payload = (await upload.json()) as { path?: string };
        imagePath = payload.path;
      }
      const response = await fetch(`/api/support/tickets/${active.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft, imagePath }),
      });
      if (!response.ok) {
        setError(await readError(response, 'ارسال پیام ناموفق بود.'));
        return;
      }
      setDraft('');
      setAttach(null);
      if (fileInput.current) {
        fileInput.current.value = '';
      }
      await openTicket(active);
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setSending(false);
    }
  }

  function pickImage(file: File | null) {
    if (file && file.size > MAX_IMAGE_BYTES) {
      setError('حجم تصویر باید حداکثر ۲۰۰ کیلوبایت باشد.');
      return;
    }
    if (file && !['image/png', 'image/jpeg'].includes(file.type)) {
      setError('فقط تصاویر JPG و PNG پذیرفته می‌شوند.');
      return;
    }
    setError(null);
    setAttach(file);
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
            <Text size="xs" c="dimmed" style={{ direction: 'ltr' }}>
              {active.displayId}
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

        <Group gap="xs">
          <Badge
            color={
              TICKET_STATUS_COLORS[active.status as keyof typeof TICKET_STATUS_COLORS] ?? 'gray'
            }
            variant="light"
          >
            {TICKET_STATUS_LABELS[active.status as keyof typeof TICKET_STATUS_LABELS] ??
              active.status}
          </Badge>
        </Group>
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
          <Stack gap="xs">
            {attach && attachPreview ? (
              <Group
                gap="sm"
                justify="space-between"
                wrap="nowrap"
                p="xs"
                style={{
                  border: '1px dashed var(--mantine-color-gray-4)',
                  borderRadius: 8,
                }}
              >
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Image
                    src={attachPreview}
                    alt="پیش‌نمایش پیوست"
                    h={40}
                    w={40}
                    fit="cover"
                    radius="sm"
                  />
                  <Stack gap={0} style={{ minWidth: 0 }}>
                    <Text size="xs" truncate style={{ maxWidth: 180 }}>
                      {attach.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {(attach.size / 1024).toFixed(0)} کیلوبایت
                    </Text>
                  </Stack>
                </Group>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label="حذف تصویر پیوست"
                  onClick={() => {
                    setAttach(null);
                    if (fileInput.current) {
                      fileInput.current.value = '';
                    }
                  }}
                >
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            ) : null}

            <Group gap="xs" align="flex-end" wrap="nowrap">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={(event) => pickImage(event.target.files?.[0] ?? null)}
              />
              <ActionIcon
                variant="default"
                size="lg"
                aria-label="پیوست عکس"
                disabled={sending}
                onClick={() => fileInput.current?.click()}
              >
                <IconPaperclip size={16} />
              </ActionIcon>
              <Textarea
                placeholder={
                  draft.trim() === '' && attach
                    ? 'پیام اختیاری است — فقط تصویر هم ارسال می‌شود.'
                    : 'پاسخ خود را بنویسید…'
                }
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
                disabled={!draft.trim() && !attach}
                aria-label="ارسال پاسخ"
              >
                <IconSend size={18} />
              </ActionIcon>
            </Group>
          </Stack>
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
                  <Text size="sm" fw={600} truncate style={{ minWidth: 0 }}>
                    {ticket.subject}
                  </Text>
                  {ticket.unread ? <Badge color="red" size="xs" variant="filled" /> : null}
                </Group>
                <Group justify="space-between" mt={6} gap="xs">
                  <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
                    {ticket.lastMessage}
                  </Text>
                  <Badge
                    size="xs"
                    variant="light"
                    color={
                      TICKET_STATUS_COLORS[ticket.status as keyof typeof TICKET_STATUS_COLORS] ??
                      'gray'
                    }
                  >
                    {TICKET_STATUS_LABELS[ticket.status as keyof typeof TICKET_STATUS_LABELS] ??
                      ticket.status}
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
