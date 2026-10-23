'use client';

import { IconCreditCard } from '@tabler/icons-react';
import { Badge, Group, Stack, Text } from '@mantine/core';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import { enCurrency } from '@/lib/format';
import {
  gatewayLabel,
  PAYMENT_KIND_LABELS,
  PAYMENT_STATE_LABELS,
  VERIFY_INFO_LABELS,
} from '@/lib/payment-defs';
import type { AdminOnlinePaymentDTO } from '@/lib/wallet';

const STATE_COLORS: Record<AdminOnlinePaymentDTO['state'], string> = {
  pending: 'yellow',
  verified: 'green',
  failed: 'red',
};

export interface OnlinePaymentsTableProps {
  payments: AdminOnlinePaymentDTO[];
}

/**
 * لیست تراکنش‌های درگاه روی قاعده مشترک PanelList — هر تلاش پرداخت همه
 * مشتریان با درگاهِ انجام‌دهنده و وضعیتش. دسکتاپ: کلیک روی ردیف، اطلاعات
 * پرداختِ تأییدشده درگاه (شماره کارت، کارمزد، کد مرجع، authority) را زیر همان
 * ردیف باز می‌کند. موبایل: کارت + لینک سفارش مرتبط (وقتی تراکنش به سفارشی
 * وصل است) به صفحه واحد جزئیات.
 */
export default function OnlinePaymentsTable({ payments }: OnlinePaymentsTableProps) {
  const columns: PanelColumn<AdminOnlinePaymentDTO>[] = [
    {
      key: 'customer',
      header: 'مشتری',
      cardTitle: true,
      card: (payment) => payment.userName,
      cell: (payment) => (
        <Stack gap={2}>
          <Text size="sm" fw={500}>
            {payment.userName}
          </Text>
          <Text size="xs" c="dimmed" dir="ltr" style={{ textAlign: 'end' }}>
            {payment.userPhone ?? '—'}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'date',
      header: 'تاریخ',
      cell: (payment) => (
        <Text size="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {payment.date}
        </Text>
      ),
    },
    {
      key: 'kind',
      header: 'نوع',
      cell: (payment) => (
        <Badge variant="light" color="blue" radius="sm" size="sm">
          {PAYMENT_KIND_LABELS[payment.kind]}
        </Badge>
      ),
    },
    {
      key: 'gateway',
      header: 'درگاه',
      cell: (payment) => (
        <Text size="sm" fw={500}>
          {gatewayLabel(payment.gateway)}
        </Text>
      ),
    },
    {
      key: 'amount',
      header: 'مبلغ',
      card: (payment) => (
        <Text size="sm" fw={700}>
          {enCurrency(payment.amount, false)}
        </Text>
      ),
      cell: (payment) => (
        <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {enCurrency(payment.amount, false)}
        </Text>
      ),
    },
    {
      key: 'state',
      header: 'وضعیت',
      cardHead: true,
      cell: (payment) => (
        <Badge variant="light" color={STATE_COLORS[payment.state]} radius="sm" size="sm">
          {PAYMENT_STATE_LABELS[payment.state]}
        </Badge>
      ),
    },
    {
      key: 'ref',
      header: 'کد پیگیری',
      cell: (payment) => (
        <Text size="sm" ff="monospace" dir="ltr" ta="start">
          {payment.refId ? Number(payment.refId) : '—'}
        </Text>
      ),
    },
    {
      key: 'order',
      header: 'سفارش',
      cell: (payment) => (
        <Text size="sm" ff="monospace" dir="ltr" ta="start">
          {payment.orderDisplayId ?? '—'}
        </Text>
      ),
    },
  ];

  return (
    <PanelList<AdminOnlinePaymentDTO>
      rows={payments}
      columns={columns}
      getRowId={(payment) => payment.id}
      renderDetail={(payment) => {
        const infoEntries = Object.entries(payment.verifyInfo).filter(([key]) => key !== 'cardPan');
        return (
          <Stack gap={6}>
            <Stack gap={4}>
              <InfoLine label="درگاه" value={gatewayLabel(payment.gateway)} />
              <InfoLine label="شناسه درگاه (authority)" value={payment.authority ?? '—'} mono />
              <InfoLine
                label="کد مرجع"
                value={payment.refId ? Number(payment.refId).toLocaleString('en-US') : '—'}
                mono
              />
              <InfoLine label={VERIFY_INFO_LABELS.cardPan} value={payment.cardPan ?? '—'} mono />
              {infoEntries.map(([key, value]) => (
                <InfoLine key={key} label={VERIFY_INFO_LABELS[key] ?? key} value={value} mono />
              ))}
            </Stack>
            {payment.state !== 'verified' ? (
              <Text size="xs" c="dimmed">
                {payment.state === 'pending'
                  ? 'پرداخت هنوز تأیید نشده — اطلاعات پس از تأیید درگاه کامل می‌شود.'
                  : 'پرداخت ناموفق بوده و اطلاعات تأییدی ثبت نشده است.'}
              </Text>
            ) : null}
          </Stack>
        );
      }}
      detailHeading={(payment) =>
        `اطلاعات پرداخت ${payment.orderDisplayId ? `— سفارش ${payment.orderDisplayId}` : ''}`
      }
      detailHref={(payment) =>
        payment.orderDisplayId
          ? `/orders/${encodeURIComponent(payment.orderDisplayId)}/items`
          : null
      }
      detailLabel={(payment) => `جزئیات سفارش ${payment.orderDisplayId ?? ''}`.trim()}
      empty={{
        icon: IconCreditCard,
        message: 'تراکنش درگاه موجود نیست.',
        hint: 'اولین پرداخت آنلاین همین‌جا نمایش داده می‌شود.',
      }}
    />
  );
}

/** یک ردیف برچسب/مقدار جزئیات. */
function InfoLine({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" ff={mono ? 'monospace' : undefined} dir={mono ? 'ltr' : undefined}>
        {value}
      </Text>
    </Group>
  );
}
