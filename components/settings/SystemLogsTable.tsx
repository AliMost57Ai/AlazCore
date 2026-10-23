'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconAlertCircle, IconCircleCheck, IconTrash } from '@tabler/icons-react';
import { Badge, Button, Code, Group, Modal, Select, Stack, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import ListFilterForm from '@/components/ui/panel/ListFilterForm';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import {
  ACTION_LABELS,
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

const SHAHKAR_LABELS: Record<string, string> = {
  shahkar: 'شاهکار',
};

/** برچسب فارسی محورهای دسترسی/سفارش. */
const AUDIT_PROVIDER_LABELS: Record<string, string> = {
  roles: 'نقش‌ها',
  'role-groups': 'گروه نقش‌ها',
  users: 'کاربران',
  customers: 'مشتریان',
  orders: 'سفارش‌ها',
  pickup: 'تحویل حضوری',
};

function providerLabel(log: SystemLogDTO): string {
  const labels =
    log.kind === 'sms'
      ? SMS_PANEL_LABELS
      : log.kind === 'shahkar'
        ? SHAHKAR_LABELS
        : log.kind === 'access' || log.kind === 'order'
          ? AUDIT_PROVIDER_LABELS
          : GATEWAY_LABELS;
  return labels[log.provider] ?? log.provider;
}

function kindBadge(log: SystemLogDTO) {
  return (
    <Badge
      color={KIND_COLORS[log.kind] ?? 'gray'}
      variant="light"
      radius="sm"
      title={KIND_LABELS[log.kind] ?? log.kind}
    >
      {KIND_LABELS[log.kind] ?? log.kind}
    </Badge>
  );
}

export interface SystemLogsTableProps {
  logs: SystemLogDTO[];
  /** فیلتر فعال از سرور (GET kind) — تغییرش فرم GET را سابمیت می‌کند. */
  activeKind: 'all' | SystemLogKind;
}

/**
 * The system-log viewer (لاگ‌های سیستمی) روی قاعده مشترک PanelList: خطاهای
 * درگاه/پیامک/شاهکار با پاسخ API مقصد + رویدادهای دسترسی و سفارش با «توسط».
 * دسکتاپ: ردیف‌های دارای پاسخ API با کلیک باز می‌شوند؛ موبایل: پاسخ API داخل
 * کارت و بدون تعامل نمایش داده می‌شود. فیلتر نوع با فرم GET واحد پنل سفر
 * می‌کند — Select عمداً uncontrolled است (defaultValue) تا کاربر بتواند
 * تغییرش دهد؛ سابمیت با دکمه جستجو.
 */
export default function SystemLogsTable({ logs, activeKind }: SystemLogsTableProps) {
  const router = useRouter();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function clear() {
    setClearing(true);
    try {
      const query = activeKind === 'all' ? '' : `?kind=${activeKind}`;
      const response = await fetch(`/api/admin/system-logs${query}`, { method: 'DELETE' });
      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: 'پاک کردن لاگ‌ها ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }
      notifications.show({
        title: 'انجام شد',
        message: 'لاگ‌های سیستمی پاک شد.',
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
      router.refresh();
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  }

  const columns: PanelColumn<SystemLogDTO>[] = [
    {
      key: 'time',
      header: 'تاریخ و ساعت',
      cell: (log) => (
        <Text size="sm" ff="monospace" dir="ltr" ta="start" style={{ whiteSpace: 'nowrap' }}>
          {log.createdAt}
        </Text>
      ),
    },
    {
      key: 'kind',
      header: 'نوع',
      cardHead: true,
      cell: kindBadge,
    },
    {
      key: 'provider',
      header: 'درگاه / پنل',
      cell: (log) => (
        <Text size="sm" fw={500}>
          {providerLabel(log)}
        </Text>
      ),
    },
    {
      key: 'action',
      header: 'عملیات',
      cell: (log) => <Text size="sm">{ACTION_LABELS[log.action] ?? log.action}</Text>,
    },
    {
      key: 'actor',
      header: 'توسط',
      cell: (log) => (
        <Text size="sm" c={log.actorName ? undefined : 'dimmed'}>
          {log.actorName || '—'}
        </Text>
      ),
    },
    {
      key: 'message',
      header: 'رویداد / خطا',
      cell: (log) => (
        <Text size="sm" lineClamp={2} style={{ whiteSpace: 'normal' }}>
          {log.message}
        </Text>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <ListFilterForm
        action="/logs"
        hasFilters={activeKind !== 'all'}
        actions={
          <Tooltip label="لاگ‌های این دسته برای همیشه حذف می‌شوند" withArrow>
            <Button
              variant="light"
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={() => setConfirmClear(true)}
              disabled={logs.length === 0}
            >
              پاک کردن لاگ‌ها
            </Button>
          </Tooltip>
        }
      >
        <Select
          name="kind"
          /* uncontrolled + key per URL — مقدار انتخابی با فرم GET سابمیت می‌شود. */
          key={activeKind}
          defaultValue={activeKind}
          data={[
            { value: 'all', label: 'همه انواع' },
            ...Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          allowDeselect={false}
          size="sm"
          radius="md"
          aria-label="فیلتر نوع لاگ"
          w={{ base: '100%', xs: 190 }}
        />
      </ListFilterForm>

      <PanelList<SystemLogDTO>
        rows={logs}
        columns={columns}
        getRowId={(log) => log.id}
        renderDetail={(log) => (
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              پاسخ API مقصد:
            </Text>
            <Code block style={{ whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left' }}>
              {log.detail}
            </Code>
          </Stack>
        )}
        hasDetail={(log) => log.detail !== ''}
        detailHeading={(log) => `پاسخ API مقصد — ${providerLabel(log)}`}
        cardExtra={(log) =>
          log.detail !== '' ? (
            <Stack gap={4} mt={8}>
              <Text size="xs" c="dimmed">
                پاسخ API مقصد:
              </Text>
              <Code block style={{ whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left' }}>
                {log.detail}
              </Code>
            </Stack>
          ) : null
        }
        empty={{
          icon: IconCircleCheck,
          message: loadingLabel(activeKind),
          hint: 'خطاهای درگاه/پیامک/شاهکار و رویدادهای دسترسی و سفارش همین‌جا ثبت می‌شوند.',
        }}
      />

      <Modal
        opened={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="پاک کردن لاگ‌ها"
        centered
      >
        <Text mb="md">
          {activeKind === 'all'
            ? 'همه لاگ‌های سیستمی پاک شوند؟ این کار قابل بازگشت نیست.'
            : `لاگ‌های «${KIND_LABELS[activeKind]}» پاک شوند؟ این کار قابل بازگشت نیست.`}
        </Text>
        <Group justify="end">
          <Button variant="subtle" onClick={() => setConfirmClear(false)}>
            انصراف
          </Button>
          <Button color="red" loading={clearing} onClick={() => void clear()}>
            پاک شود
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}

function loadingLabel(kind: 'all' | SystemLogKind): string {
  return kind === 'all'
    ? 'رویدادی ثبت نشده است.'
    : kind === 'access'
      ? 'رویدادی از دسترسی و حساب‌ها ثبت نشده است.'
      : kind === 'order'
        ? 'رویدادی از تغییر سفارش‌ها ثبت نشده است.'
        : 'خطایی از این سرویس ثبت نشده است.';
}
