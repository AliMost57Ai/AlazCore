'use client';

/**
 * کامپوننت ژنریک تیکتینگ سمت کور — بازنویسی روی واژه‌نامه نسخه مرجع
 * (۳ وضعیت، نخوانده مشتق، displayId، جست‌وجو/فیلتر نخوانده/AutoRefresh).
 * گفتگو مالک فروشگاه ↔ پرسنل پشتیبانی آلازکور.
 *
 * قاعده پنل: هیچ گفتگویی مودال نیست — کلیک روی ردیف به صفحه اختصاصی
 * ${detailHrefBase}/${ticket.id} می‌رود (آینه components/tickets/TicketsManager.tsx
 * نسخه فروشگاه؛ همگام‌سازی دستی). تیکت جدید ۳ فیلد است و طبق قاعده modal-to-page
 * مودال می‌ماند. جدول دستی موقتاً جای PanelList می‌نشیند (لایه پنل کور هنوز
 * پورت نشده — کار آینده مستندشده در .ai/tasks).
 *
 * این کامپوننت از هیچ API مستقیمی خبر ندارد؛ همه چیز از props می‌آید:
 *  - tickets: داده‌ی فهرست (همین ساختار در هر دو اپ است)
 *  - onReload: تازه‌سازی داده پس از هر تغییر و برای AutoRefresh
 *  - adapter: عملیات نوشتن (ایجاد) — ساید کور
 *  - role: برچسب دو طرف گفتگو و اینکه کاربر فعلی کدام سمت است
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  ScrollArea,
  SegmentedControl,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { faDateTime } from '@/lib/format';
import {
  TICKET_STATUS_COLORS,
  TICKET_STATUS_LABELS,
} from '@/lib/ticket-status';
import {
  isUnreadForViewer,
  type GenericTicket,
  type TicketAdapter,
  type TicketRoleConfig,
} from './tickets-shared';

export type {
  GenericTicket,
  GenericTicketMessage,
  TicketAdapter,
  TicketRoleConfig,
} from './tickets-shared';

export interface TicketsManagerProps {
  title: string;
  description?: string;
  tickets: GenericTicket[] | null;
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void> | void;
  adapter: TicketAdapter;
  role: TicketRoleConfig;
  /** ستون «طرف مقابل» (دامنه) — پیش‌فرض روشن در پنل کور. */
  showCounterpart?: boolean;
  /** برچسب دکمه ایجاد تیکت. */
  createLabel?: string;
  /** مسیر پایه صفحه اختصاصی گفتگو (مثلاً /panel/tickets) — کلیک روی ردیف به
   *  ${detailHrefBase}/${ticket.id} می‌رود؛ هیچ گفتگویی مودال نیست. */
  detailHrefBase?: string;
}

export default function TicketsManager({
  title,
  description,
  tickets,
  loading,
  error,
  onReload,
  adapter,
  role,
  showCounterpart = true,
  createLabel = 'تیکت جدید',
  detailHrefBase,
}: TicketsManagerProps) {
  const [filter, setFilter] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // AutoRefresh مرجع: polling visibility-gated لیست پنل.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void onReload();
      }
    }, 20_000);
    return () => clearInterval(timer);
  }, [onReload]);

  const filtered = useMemo(() => {
    if (!tickets) {
      return [];
    }
    const q = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (filter !== 'all' && ticket.status !== filter) {
        return false;
      }
      if (unreadOnly && !isUnreadForViewer(role.viewerSide, ticket)) {
        return false;
      }
      if (q) {
        const haystack = [ticket.displayId, ticket.subject, ticket.requesterName, ticket.counterpart ?? '']
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [tickets, filter, unreadOnly, query, role.viewerSide]);

  const waitingCount = useMemo(
    () => (tickets ?? []).filter((ticket) => isUnreadForViewer(role.viewerSide, ticket)).length,
    [tickets, role.viewerSide]
  );

  const router = useRouter();

  async function submitCreate() {
    if (!subject.trim() || !body.trim()) {
      notifications.show({ message: 'موضوع و متن پیام الزامی است.', color: 'red' });
      return;
    }
    setBusy(true);
    try {
      const id = await adapter.create({ subject: subject.trim(), body: body.trim() });
      if (!id) {
        return;
      }
      notifications.show({ message: 'تیکت ثبت شد.', color: 'brand' });
      setSubject('');
      setBody('');
      closeCreate();
      await onReload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Stack gap={2}>
          <Title order={2}>{title}</Title>
          {description ? (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          ) : null}
          {waitingCount > 0 ? (
            <Text size="sm" fw={600} c="orange">
              {waitingCount} تیکت در انتظار پاسخ شماست.
            </Text>
          ) : null}
        </Stack>
        <Button radius="xl" onClick={openCreate} style={{ flexShrink: 0 }}>
          {createLabel}
        </Button>
      </Group>

      <Group gap="sm" wrap="wrap" align="center">
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          data={[
            { value: 'all', label: 'همه' },
            ...Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          w="fit-content"
        />
        <TextInput
          placeholder="جست‌وجو: شماره، موضوع، مالک، دامنه…"
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          w={280}
          aria-label="جست‌وجوی تیکت"
        />
        <Switch
          label="فقط نخوانده‌ها"
          checked={unreadOnly}
          onChange={(event) => setUnreadOnly(event.currentTarget.checked)}
        />
      </Group>

      <Card padding="lg" withBorder>
        {loading && tickets === null ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            در حال دریافت…
          </Text>
        ) : error ? (
          <Text size="sm" c="red" ta="center" py="xl">
            {error}
          </Text>
        ) : (
          <ScrollArea>
            <Table highlightOnHover verticalSpacing="sm" style={{ minWidth: 860 }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={110}>شماره</Table.Th>
                  <Table.Th>درخواست‌کننده</Table.Th>
                  {showCounterpart ? <Table.Th>دامنه</Table.Th> : null}
                  <Table.Th>موضوع</Table.Th>
                  <Table.Th>آخرین پیام</Table.Th>
                  <Table.Th>وضعیت</Table.Th>
                  <Table.Th>آخرین فعالیت</Table.Th>
                  <Table.Th>عملیات</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((ticket) => (
                  <Table.Tr
                    key={ticket.id}
                    onClick={() => {
                      if (detailHrefBase) {
                        router.push(`${detailHrefBase}/${encodeURIComponent(ticket.id)}`);
                      }
                    }}
                    style={detailHrefBase ? { cursor: 'pointer' } : undefined}
                  >
                    <Table.Td ff="monospace" style={{ direction: 'ltr' }}>
                      {ticket.displayId}
                    </Table.Td>
                    <Table.Td>{ticket.requesterName}</Table.Td>
                    {showCounterpart ? (
                      <Table.Td c="dimmed">{ticket.counterpart ?? '—'}</Table.Td>
                    ) : null}
                    <Table.Td fw={600}>{ticket.subject}</Table.Td>
                    <Table.Td c="dimmed" maw={240}>
                      <Text size="sm" c="dimmed" truncate style={{ maxWidth: 240 }}>
                        {ticket.lastMessage}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm"
                        variant="light"
                        color={TICKET_STATUS_COLORS[ticket.status as keyof typeof TICKET_STATUS_COLORS] ?? 'gray'}
                      >
                        {TICKET_STATUS_LABELS[ticket.status as keyof typeof TICKET_STATUS_LABELS] ??
                          ticket.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td c="dimmed">{faDateTime(new Date(ticket.lastMessageAt))}</Table.Td>
                    <Table.Td onClick={(event) => event.stopPropagation()}>
                      {isUnreadForViewer(role.viewerSide, ticket) ? (
                        <Badge size="sm" variant="filled" color="red">
                          نخوانده
                        </Badge>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                ))}
                {filtered.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={showCounterpart ? 8 : 7} ta="center" c="dimmed" py="xl">
                      تیکتی یافت نشد.
                    </Table.Td>
                  </Table.Tr>
                ) : null}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Card>

      {/* ── تیکت جدید (۳ فیلد — طبق قاعده modal-to-page مودال می‌ماند) ── */}
      <Modal opened={createOpened} onClose={closeCreate} title="تیکت جدید" size="md" centered>
        <Stack gap="sm">
          <TextInput
            label="موضوع"
            required
            maxLength={120}
            value={subject}
            onChange={(e) => setSubject(e.currentTarget.value)}
          />
          <Textarea
            label="متن پیام"
            required
            autosize
            minRows={4}
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.currentTarget.value)}
          />
          <Group justify="end">
            <Button variant="subtle" onClick={closeCreate}>
              انصراف
            </Button>
            <Button loading={busy} onClick={() => void submitCreate()}>
              ثبت تیکت
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
