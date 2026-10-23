'use client';

/**
 * کامپوننت ژنریک تیکتینگ — یک بار نوشته شده، چند بار استفاده‌شده:
 *  - ساید panel  (پنل Core): گفتگو مالک فروشگاه ↔ پرسنل پشتیبانی آلازکور
 *    (پرسنل Core با authorSide 'core' پاسخ می‌دهد، وضعیت را هم عوض می‌کند).
 *  - ساید dashboard (فروشگاه): گفتگو مشتری ↔ مالک فروشگاه و صفحهٔ پشتیبانیِ
 *    مالک با سامانه Core — فقط با عوض شدن props/adapterها، بدون کد تکراری.
 *
 * این کامپوننت از هیچ API مستقیمی خبر ندارد؛ همه چیز از props می‌آید:
 *  - tickets: داده‌ی فهرست (همین ساختار در هر دو سمت است)
 *  - onReload: تازه‌سازی داده پس از هر تغییر و برای AutoRefresh
 *  - adapter: عملیات نوشتن (ایجاد/پاسخ/تغییر وضعیت) — هر ساید پیاده‌سازی خودش
 *  - role: برچسب دو طرف گفتگو و اینکه کاربر فعلی کدام سمت است
 *  - detailHrefBase: مسیر صفحه اختصاصی گفتگو — کلیک روی ردیف (دسکتاپ و موبایل)
 *    به ${detailHrefBase}/${ticket.id} می‌رود؛ هیچ گفتگویی مودال نیست (قاعده پنل).
 *  - features: جست‌وجو، فیلتر «فقط نخوانده» و AutoRefresh — سمت‌های پشتیبان
 *    روشن می‌کنند (رفتار نسخه مرجع: پنل پشتیبان جست‌وجو/نخوانده/۲۰ثانیه دارد).
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconMessages, IconSearch } from '@tabler/icons-react';
import {
  Badge,
  Button,
  Group,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import ResponsiveModal from '@/components/ui/panel/ResponsiveModal';
import { faJalaliLongDate } from '@/lib/format';
import { TICKET_STATUS_LABELS } from '@/lib/ticket-status';
import {
  isUnreadForViewer,
  TICKET_STATUS_COLOR,
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
export { TICKET_STATUS_COLOR, TICKET_STATUS_LABEL } from './tickets-shared';

/** فیچرهای اختیاری پنل پشتیبان — پیش‌فرض همه خاموش تا ساده بماند. */
export interface TicketsManagerFeatures {
  /** جست‌وجوی متنی سمت کلاینت روی displayId/موضوع/درخواست‌کننده. */
  search?: boolean;
  /** سوییچ «فقط نخوانده‌ها» بر پایه قاعده مشتق lib/ticket-status. */
  unreadOnly?: boolean;
  /** polling لیست (میلی‌ثانیه) — visibility-gated، مثل AutoRefresh مرجع. */
  autoRefreshMs?: number;
}

export interface TicketsManagerProps {
  title: string;
  description?: string;
  tickets: GenericTicket[] | null;
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void> | void;
  adapter: TicketAdapter;
  role: TicketRoleConfig;
  /** آیا ستون «طرف مقابل» در جدول نمایش داده شود (دامنه در پنل Core). */
  showCounterpart?: boolean;
  /** آیا کاربر این ساید می‌تواند تیکت بسازد (مالک در /support بله؛ پنل‌ها خیر). */
  canCreate?: boolean;
  /** برچسب دکمه ایجاد تیکت. */
  createLabel?: string;
  /** مسیر پایه صفحه اختصاصی گفتگو (مثلاً /customer-support) — کلیک روی ردیف
   *  در دسکتاپ و موبایل به `${detailHrefBase}/${ticket.id}` می‌رود؛ هیچ
   *  گفتگویی مودال نیست. */
  detailHrefBase?: string;
  features?: TicketsManagerFeatures;
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
  showCounterpart = false,
  canCreate = true,
  createLabel = 'تیکت جدید',
  detailHrefBase,
  features,
}: TicketsManagerProps) {
  const [filter, setFilter] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // AutoRefresh مرجع: polling visibility-gated — تب پنهان ترافیک نمی‌سازد.
  useEffect(() => {
    if (!features?.autoRefreshMs) {
      return undefined;
    }
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void onReload();
      }
    }, features.autoRefreshMs);
    return () => clearInterval(timer);
  }, [features?.autoRefreshMs, onReload]);

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
        const haystack = [
          ticket.displayId,
          ticket.subject,
          ticket.requesterName,
          ticket.requesterPhone ?? '',
          ticket.counterpart ?? '',
        ]
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

  // قاعده پنل: هیچ گفتگویی مودال نیست — کلیک روی ردیف (دسکتاپ و موبایل) به
  // صفحه اختصاصی ${detailHrefBase}/${id} می‌رود که رشته کامل + Context دارد.
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

  const columns: PanelColumn<GenericTicket>[] = [
    {
      key: 'displayId',
      header: 'شماره',
      w: 110,
      cell: (ticket) => (
        <Text size="sm" ff="monospace" style={{ direction: 'ltr' }}>
          {ticket.displayId}
        </Text>
      ),
      desktopOnly: true,
    },
    {
      key: 'requester',
      header: 'درخواست‌کننده',
      w: 170,
      cell: (ticket) => (
        <Stack gap={2}>
          <Group gap={6} wrap="nowrap">
            <Text size="sm" truncate style={{ minWidth: 0 }}>
              {ticket.requesterName}
            </Text>
            {ticket.isGuest ? (
              <Badge size="xs" variant="light" color="grape">
                مهمان
              </Badge>
            ) : null}
          </Group>
          {ticket.requesterPhone ? (
            <Text size="xs" c="dimmed" style={{ direction: 'ltr' }}>
              {ticket.requesterPhone}
            </Text>
          ) : null}
        </Stack>
      ),
    },
    ...(showCounterpart
      ? [
          {
            key: 'counterpart',
            header: 'طرف مقابل',
            cell: (ticket: GenericTicket) => (
              <Text size="sm" c="dimmed">
                {ticket.counterpart ?? '—'}
              </Text>
            ),
          } satisfies PanelColumn<GenericTicket>,
        ]
      : []),
    {
      key: 'subject',
      header: 'موضوع',
      cardTitle: true,
      card: (ticket) => ticket.subject,
      cell: (ticket) => (
        <Text size="sm" fw={600}>
          {ticket.subject}
        </Text>
      ),
    },
    {
      key: 'lastMessage',
      header: 'آخرین پیام',
      cell: (ticket) => (
        <Text size="sm" c="dimmed" truncate style={{ maxWidth: 260 }}>
          {ticket.lastMessage}
        </Text>
      ),
      card: (ticket) => (
        <Text size="xs" c="dimmed" truncate style={{ maxWidth: '100%' }}>
          {ticket.lastMessage}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'وضعیت',
      cardHead: true,
      sortValue: (ticket) => ticket.status,
      cell: (ticket) => (
        <Badge size="sm" variant="light" radius="sm" color={TICKET_STATUS_COLOR[ticket.status]}>
          {TICKET_STATUS_LABELS[ticket.status as keyof typeof TICKET_STATUS_LABELS] ??
            ticket.status}
        </Badge>
      ),
    },
    {
      key: 'updated',
      header: 'آخرین فعالیت',
      sortValue: (ticket) => new Date(ticket.lastMessageAt).getTime(),
      cell: (ticket) => (
        <Text size="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {faJalaliLongDate(new Date(ticket.lastMessageAt))}
        </Text>
      ),
    },
  ];

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
          {features?.unreadOnly && waitingCount > 0 ? (
            <Text size="sm" fw={600} c="orange">
              {waitingCount} تیکت در انتظار پاسخ شماست.
            </Text>
          ) : null}
        </Stack>
        {canCreate ? (
          <Button radius="xl" onClick={openCreate} style={{ flexShrink: 0 }}>
            {createLabel}
          </Button>
        ) : null}
      </Group>

      <Group gap="sm" wrap="wrap" align="center">
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          data={[
            { value: 'all', label: 'همه' },
            ...Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          /* در موبایل تمام‌عرض می‌شود تا ردیف فیلتر، اسکرول افقی نسازد. */
          fullWidth
          w={{ base: '100%', sm: 'fit-content' }}
        />
        {features?.search ? (
          <TextInput
            placeholder="جست‌وجو: شماره، موضوع، نام، موبایل…"
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            w={{ base: '100%', sm: 280 }}
            aria-label="جست‌وجوی تیکت"
          />
        ) : null}
        {features?.unreadOnly ? (
          <Switch
            label="فقط نخوانده‌ها"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.currentTarget.checked)}
          />
        ) : null}
      </Group>

      {loading && tickets === null ? (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          در حال دریافت…
        </Text>
      ) : error ? (
        <Text size="sm" c="red" ta="center" py="xl">
          {error}
        </Text>
      ) : (
        <PanelList<GenericTicket>
          rows={filtered}
          columns={columns}
          getRowId={(ticket) => ticket.id}
          onRowActivate={(ticket) => {
            if (detailHrefBase) {
              router.push(`${detailHrefBase}/${encodeURIComponent(ticket.id)}`);
            }
          }}
          activateLabel={(ticket) => `گفتگوی «${ticket.subject}»`}
          detailHref={
            detailHrefBase
              ? (ticket) => `${detailHrefBase}/${encodeURIComponent(ticket.id)}`
              : undefined
          }
          detailLabel={(ticket) => `گفتگوی «${ticket.subject}»`}
          renderActions={(ticket) =>
            isUnreadForViewer(role.viewerSide, ticket) ? (
              <Badge size="sm" variant="filled" color="red">
                نخوانده
              </Badge>
            ) : null
          }
          empty={{
            icon: IconMessages,
            message: 'تیکتی یافت نشد.',
            hint: 'با تغییر فیلتر وضعیت یا ساخت تیکت جدید، گفتگوها همین‌جا نمایش داده می‌شوند.',
          }}
        />
      )}

      {/* ── تیکت جدید ─────────────────────────────────────────────── */}
      <ResponsiveModal opened={createOpened} onClose={closeCreate} title="تیکت جدید">
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
      </ResponsiveModal>
    </Stack>
  );
}
