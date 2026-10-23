'use client';

import { useState } from 'react';
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconTrash,
} from '@tabler/icons-react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Code,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  ACTION_LABELS,
  AUDIT_KINDS,
  FAILURE_KINDS,
  isAuditKind,
  KIND_COLORS,
  KIND_LABELS,
  type SystemLogDTO,
  type SystemLogKind,
} from '@/lib/system-log-defs';

/** Persian labels for gateway ids — kept local so the client bundle stays
 *  free of the server-only gateway drivers (node:crypto). */
const GATEWAY_LABELS: Record<string, string> = {
  zarinpal: 'زرین‌پال',
  idpay: 'آیدی‌پی',
  parsian: 'پارسیان',
  mellat: 'ملت',
  saman: 'سامان',
  sadad: 'سداد',
  sepah: 'سپه (امیدپی)',
  sizpay: 'سیزپی',
  pasargad: 'پاسارگاد',
  digipay: 'دیجی‌پی',
  snapppay: 'اسنپ‌پی',
  tara: 'تارا',
  vibe: 'وایب',
  keepa: 'کیپا',
  minipay: 'مینی‌پی',
  fakher: 'فاخر',
};

const SMS_PANEL_LABELS: Record<string, string> = {
  mediana: 'مدیانا',
  smsir: 'sms.ir',
  melipayamak: 'ملی‌پیامک',
  farazsms: 'فراز اس‌ام‌اس',
  payamresan: 'پیام رسان',
};

/** The source of a failure row: the gateway or SMS panel that answered. */
function providerLabel(log: SystemLogDTO): string {
  if (log.kind === 'sms') {
    return SMS_PANEL_LABELS[log.provider] ?? log.provider;
  }
  if (log.kind === 'shahkar') {
    return 'شاهکار';
  }
  return GATEWAY_LABELS[log.provider] ?? log.provider;
}

const DASH = '—';

type KindFilter = 'all' | SystemLogKind;

/** The kind filter, grouped so seven options stay readable in one control. */
const FILTER_DATA = [
  { group: 'نمایش', items: [{ value: 'all', label: 'همه لاگ‌ها' }] },
  {
    group: 'رخدادهای کارمندان',
    items: AUDIT_KINDS.map((kind) => ({ value: kind, label: KIND_LABELS[kind] })),
  },
  {
    group: 'خطاهای سیستمی',
    items: FAILURE_KINDS.map((kind) => ({ value: kind, label: KIND_LABELS[kind] })),
  },
];

/**
 * The system-log viewer (لاگ‌های سیستمی). Two families share one table, and the
 * columns say which is which: a failure row names the gateway or SMS panel that
 * answered and expands to its raw response, while an audit row names the staff
 * member behind the change and expands to the fields that moved.
 */
export default function SystemLogsTable({ initial }: { initial: SystemLogDTO[] }) {
  const [logs, setLogs] = useState<SystemLogDTO[]>(initial);
  const [filter, setFilter] = useState<KindFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [loading, setLoading] = useState(false);

  async function reload(next: KindFilter) {
    setLoading(true);
    try {
      const query = next === 'all' ? '' : `?kind=${next}`;
      const response = await fetch(`/api/admin/system-logs${query}`);
      const payload = (await response.json().catch(() => ({}))) as {
        logs?: SystemLogDTO[];
      };
      if (response.ok && payload.logs) {
        setLogs(payload.logs);
      }
    } finally {
      setLoading(false);
    }
  }

  function changeFilter(next: KindFilter) {
    setFilter(next);
    setExpanded(null);
    void reload(next);
  }

  async function clear() {
    const response = await fetch(
      filter === 'all' ? '/api/admin/system-logs' : `/api/admin/system-logs?kind=${filter}`,
      { method: 'DELETE' }
    );
    setConfirmClear(false);
    if (!response.ok) {
      notifications.show({
        title: 'خطا',
        message: 'پاک کردن لاگ‌ها ناموفق بود.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
      return;
    }
    setLogs([]);
    notifications.show({
      title: 'انجام شد',
      message: 'لاگ‌های سیستمی پاک شد.',
      color: 'green',
      icon: <IconCircleCheck size={18} />,
    });
  }

  const rows = logs.flatMap((log) => {
    const audit = isAuditKind(log.kind);
    const detailRows =
      expanded === log.id && log.detail !== ''
        ? [
            <Table.Tr key={`${log.id}-detail`} bg="var(--mantine-color-gray-0)">
              <Table.Td colSpan={7}>
                <Text size="xs" c="dimmed" mb={4}>
                  {audit ? 'جزئیات تغییر:' : 'پاسخ API مقصد:'}
                </Text>
                {/*
                  Two different things, so two different renderings. A gateway
                  answer is machine text (Latin keys, JSON) and reads correctly
                  only in an LTR code block; an audit detail is Persian prose,
                  and pushing it through the same LTR block mangles the bidi
                  order of every line.
                */}
                {audit ? (
                  <Text size="xs" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>
                    {log.detail}
                  </Text>
                ) : (
                  <ScrollArea type="auto" offsetScrollbars>
                    <Code
                      block
                      style={{ whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left' }}
                    >
                      {log.detail}
                    </Code>
                  </ScrollArea>
                )}
              </Table.Td>
            </Table.Tr>,
          ]
        : [];
    return [
      <Table.Tr
        key={log.id}
        style={{ cursor: log.detail !== '' ? 'pointer' : undefined }}
        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
      >
        <Table.Td>
          <Group gap={6} wrap="nowrap">
            {log.detail !== '' ? (
              expanded === log.id ? (
                <IconChevronUp size={14} />
              ) : (
                <IconChevronDown size={14} />
              )
            ) : null}
            <span style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
              {log.createdAt}
            </span>
          </Group>
        </Table.Td>
        <Table.Td>
          <Badge color={KIND_COLORS[log.kind]} variant="light" radius="sm">
            {KIND_LABELS[log.kind]}
          </Badge>
        </Table.Td>
        <Table.Td>
          {audit ? (
            <Text size="sm" c="dimmed">
              {DASH}
            </Text>
          ) : (
            providerLabel(log)
          )}
        </Table.Td>
        <Table.Td>
          {log.actor === '' ? (
            <Text size="sm" c="dimmed">
              {DASH}
            </Text>
          ) : (
            <Text size="sm">{log.actor}</Text>
          )}
        </Table.Td>
        <Table.Td>{ACTION_LABELS[log.action] ?? log.action}</Table.Td>
        <Table.Td>
          <Text size="sm" lineClamp={2}>
            {log.message}
          </Text>
        </Table.Td>
        <Table.Td w={52}>
          {log.detail !== '' ? (
            <Tooltip label={audit ? 'نمایش جزئیات تغییر' : 'نمایش پاسخ API'} withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={audit ? 'نمایش جزئیات تغییر' : 'نمایش پاسخ API'}
                onClick={(event) => {
                  event.stopPropagation();
                  setExpanded(expanded === log.id ? null : log.id);
                }}
              >
                <IconChevronDown
                  size={16}
                  style={{ transform: expanded === log.id ? 'rotate(180deg)' : undefined }}
                />
              </ActionIcon>
            </Tooltip>
          ) : null}
        </Table.Td>
      </Table.Tr>,
      ...detailRows,
    ];
  });

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="nowrap" align="flex-end">
        <Select
          label="نوع لاگ"
          w={{ base: '100%', sm: 260 }}
          data={FILTER_DATA}
          allowDeselect={false}
          value={filter}
          onChange={(value) => changeFilter((value ?? 'all') as KindFilter)}
        />
        <Button
          variant="light"
          color="red"
          leftSection={<IconTrash size={16} />}
          onClick={() => setConfirmClear(true)}
          disabled={logs.length === 0}
        >
          پاک کردن لاگ‌ها
        </Button>
      </Group>

      <Card withBorder padding={0} style={{ overflow: 'hidden' }}>
        {logs.length === 0 ? (
          <Text c="dimmed" p="md" ta="center">
            {loading ? 'در حال بارگذاری…' : 'لاگی ثبت نشده است.'}
          </Text>
        ) : (
          <ScrollArea offsetScrollbars>
            <Table highlightOnHover miw={1000}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>تاریخ و ساعت</Table.Th>
                  <Table.Th>نوع</Table.Th>
                  <Table.Th>درگاه / پنل</Table.Th>
                  <Table.Th>کاربر</Table.Th>
                  <Table.Th>عملیات</Table.Th>
                  <Table.Th>پیام</Table.Th>
                  <Table.Th w={52} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Card>

      <Modal
        opened={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="پاک کردن لاگ‌ها"
        centered
      >
        <Text mb="md">
          {filter === 'all'
            ? 'همه لاگ‌های سیستمی پاک شوند؟ این کار قابل بازگشت نیست.'
            : `لاگ‌های «${KIND_LABELS[filter]}» پاک شوند؟ این کار قابل بازگشت نیست.`}
        </Text>
        <Group justify="end">
          <Button variant="subtle" onClick={() => setConfirmClear(false)}>
            انصراف
          </Button>
          <Button color="red" onClick={() => void clear()}>
            پاک شود
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}
