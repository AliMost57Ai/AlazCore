'use client';

import { useEffect, useRef, useState } from 'react';
import { IconPaperclip, IconX } from '@tabler/icons-react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Image,
  Paper,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { faJalaliLongDate } from '@/lib/format';
import { TICKET_STATUS_LABELS } from '@/lib/ticket-status';
import {
  TICKET_STATUS_COLOR,
  type GenericTicket,
  type GenericTicketMessage,
  type TicketAdapter,
  type TicketRoleConfig,
} from './tickets-shared';

export interface TicketConversationProps {
  ticket: GenericTicket;
  role: TicketRoleConfig;
  adapter: TicketAdapter;
  /** پس از هر تغییر موفق (پاسخ/وضعیت) — caller داده را تازه می‌کند. */
  onChanged: () => void | Promise<void>;
}

/** سقف انتخاب کلاینت — سرور با جادوی بایت‌ها دوباره چک می‌کند؛ این فقط UX است. */
const MAX_IMAGE_BYTES = 200 * 1024;

/**
 * گفتگوی دوطرفه تیکت — تک منبع نمایش چت؛ همیشه داخل صفحه اختصاصی رندر می‌شود
 * (قاعده پنل: هیچ گفتگویی مودال نیست).
 *
 * واژه‌نامه مرجع: بازکردن گفتگو برای بیننده markRead می‌زند (بج نخوانده همان
 * سمت پاک می‌شود)، گفتگو هر ۱۰ ثانیه visibility-gated تازه می‌شود و تیکت بسته
 * قفل است — درخواست‌کننده فقط اعلان می‌بیند و پشتیبان باید صریحاً بازگشایی کند.
 * پیوست عکس (JPG/PNG، سقف ۲۰۰KB) فقط وقتی هست که adapter.uploadImage داشته باشد.
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
  const [attach, setAttach] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // داده تازه از والد (بازکردن گفتگو یا هر reload بعد از پاسخ) state محلی را
  // به‌روز می‌کند و برای بیننده markRead می‌زند — رفتار مرجع: بازکردن رشته =
  // خواندن آن؛ نوشتن مجدد timestamp آیدمپوتنت است.
  useEffect(() => {
    setLive(ticket);
    if (adapter.markRead) {
      void adapter.markRead(ticket.id);
    }
  }, [ticket, adapter.markRead]);

  // polling ۱۰ ثانیه‌ای گفتگو — مثل مرجع؛ پاسخ تازه بدون رفرش دیده می‌شود.
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

  function pickImage(file: File | null) {
    if (file && file.size > MAX_IMAGE_BYTES) {
      notifications.show({
        message: 'حجم تصویر باید حداکثر ۲۰۰ کیلوبایت باشد.',
        color: 'red',
      });
      return;
    }
    if (file && !['image/png', 'image/jpeg'].includes(file.type)) {
      notifications.show({ message: 'فقط تصاویر JPG و PNG پذیرفته می‌شوند.', color: 'red' });
      return;
    }
    setAttach(file);
  }

  function sideOf(message: GenericTicketMessage): 'self' | 'other' {
    return message.authorSide === role.viewerSide ? 'self' : 'other';
  }

  async function submitReply() {
    const hasText = reply.trim().length > 0;
    if (!hasText && !attach) {
      return;
    }
    setBusy(true);
    try {
      let imagePath: string | undefined;
      if (attach) {
        if (!adapter.uploadImage) {
          notifications.show({
            title: 'خطا',
            message: 'ارسال تصویر در این گفتگو نیست.',
            color: 'red',
          });
          return;
        }
        const uploaded = await adapter.uploadImage(attach);
        if (!uploaded) {
          return;
        }
        imagePath = uploaded;
      }
      const ok = await adapter.reply(live.id, reply.trim(), imagePath);
      if (!ok) {
        notifications.show({ title: 'خطا', message: 'ارسال پاسخ ناموفق بود.', color: 'red' });
        return;
      }
      setReply('');
      setAttach(null);
      if (fileInput.current) {
        fileInput.current.value = '';
      }
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
        <Badge variant="light" color={TICKET_STATUS_COLOR[live.status]}>
          {TICKET_STATUS_LABELS[live.status as keyof typeof TICKET_STATUS_LABELS] ?? live.status}
        </Badge>
        <Text size="xs" c="dimmed" style={{ marginLeft: 'auto' }}>
          {faJalaliLongDate(new Date(live.createdAt))}
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
                {faJalaliLongDate(new Date(message.createdAt))}
              </Text>
              {message.body ? (
                <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {message.body}
                </Text>
              ) : null}
              {message.imagePath ? (
                <Image
                  mt={message.body ? 6 : 0}
                  src={`/api/files/${message.imagePath}`}
                  alt="تصویر پیوست"
                  maw={280}
                  mah={220}
                  fit="contain"
                  radius="sm"
                  onClick={() => window.open(`/api/files/${message.imagePath}`, '_blank')}
                  style={{ cursor: 'zoom-in' }}
                />
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
          {attach && attachPreview ? (
            <Group
              gap="sm"
              justify="space-between"
              wrap="nowrap"
              p="xs"
              style={{ border: '1px dashed var(--mantine-color-gray-4)', borderRadius: 8 }}
            >
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                <Image
                  src={attachPreview}
                  alt="پیش‌نمایش پیوست"
                  h={48}
                  w={48}
                  fit="cover"
                  radius="sm"
                />
                <Stack gap={0} style={{ minWidth: 0 }}>
                  <Text size="xs" truncate style={{ maxWidth: 220 }}>
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
                <IconX size={16} />
              </ActionIcon>
            </Group>
          ) : null}

          <Textarea
            label="پیام"
            autosize
            minRows={3}
            maxLength={2000}
            value={reply}
            onChange={(e) => setReply(e.currentTarget.value)}
            placeholder={
              reply.trim() === '' && attach
                ? 'پیام اختیاری است — فقط تصویر هم ارسال می‌شود.'
                : 'پیام خود را بنویسید…'
            }
          />
          <Group justify="space-between">
            <Group gap="xs">
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
              ) : null}
              {adapter.uploadImage ? (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg"
                    hidden
                    onChange={(event) => pickImage(event.target.files?.[0] ?? null)}
                  />
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<IconPaperclip size={14} />}
                    disabled={busy}
                    onClick={() => fileInput.current?.click()}
                  >
                    پیوست عکس
                  </Button>
                </>
              ) : null}
            </Group>
            <Button
              loading={busy}
              disabled={!reply.trim() && !attach}
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
