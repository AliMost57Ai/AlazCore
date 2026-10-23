'use client';

import { useRouter } from 'next/navigation';
import {
  IconArrowBackUp,
  IconBan,
  IconCheck,
  IconCircleX,
  IconClock,
  IconPackageImport,
  IconSearch,
  IconSend,
  IconWallet,
} from '@tabler/icons-react';
import { Badge, Text } from '@mantine/core';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import { enCurrency, faJalaliDate, enNumber } from '@/lib/format';
import type { ReturnListItem } from '@/lib/product-returns';
import { RETURN_STATUS_COLORS, RETURN_STATUS_LABELS, type ReturnStatus } from '@/lib/return-status';

const STATUS_ICONS: Record<ReturnStatus, typeof IconCheck> = {
  requested: IconClock,
  approved: IconCheck,
  sent: IconSend,
  received: IconPackageImport,
  refunded: IconWallet,
  rejected: IconCircleX,
  cancelled: IconBan,
};

function StatusBadge({ status }: { status: ReturnStatus }) {
  const Icon = STATUS_ICONS[status];

  return (
    // Icon + text, never colour alone — همان قاعده بج سفارش‌ها.
    <Badge
      variant="light"
      color={RETURN_STATUS_COLORS[status]}
      leftSection={<Icon size={12} stroke={2.5} />}
      radius="sm"
    >
      {RETURN_STATUS_LABELS[status]}
    </Badge>
  );
}

export interface ReturnsTableProps {
  rows: ReturnListItem[];
  filtered?: boolean;
}

/**
 * جدول مرجوعی‌ها روی قاعده مشترک PanelList — دسکتاپ: کلیک ردیف به صفحه
 * جزئیات (/returns/[id])؛ موبایل: کارت با دکمه «جزئیات» به همان صفحه.
 */
export default function ReturnsTable({ rows, filtered = false }: ReturnsTableProps) {
  const router = useRouter();

  const columns: PanelColumn<ReturnListItem>[] = [
    {
      key: 'customer',
      header: 'مشتری',
      cardTitle: true,
      card: (row) => row.customerName,
      cell: (row) => (
        <Text size="sm" fw={500}>
          {row.customerName}
        </Text>
      ),
    },
    {
      key: 'displayId',
      header: 'کد مرجوعی',
      cell: (row) => (
        <Text size="sm" ff="monospace" dir="ltr" ta="start">
          {row.displayId}
        </Text>
      ),
    },
    {
      key: 'order',
      header: 'سفارش',
      cell: (row) => (
        <Text size="sm" ff="monospace" dir="ltr" ta="start" c="dimmed">
          {row.orderDisplayId}
        </Text>
      ),
    },
    {
      key: 'date',
      header: 'تاریخ ثبت',
      cell: (row) => (
        <Text size="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {faJalaliDate(row.createdAt)}
        </Text>
      ),
    },
    {
      key: 'items',
      header: 'اقلام',
      cell: (row) => (
        <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {enNumber(row.itemCount)} قلم
        </Text>
      ),
    },
    {
      key: 'amount',
      header: 'مبلغ بازگشتی',
      card: (row) => (
        <Text size="sm" fw={700}>
          {enCurrency(row.refundedAmount ?? row.refundItemsAmount, false)}
        </Text>
      ),
      cell: (row) => (
        <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {enCurrency(row.refundedAmount ?? row.refundItemsAmount, false)}
        </Text>
      ),
    },
    {
      // مدارک ارسال مشتری (کد رهگیری/عکس رسید) — جزئیات کامل در صفحهٔ اختصاصی.
      key: 'docs',
      header: 'مدارک ارسال',
      card: (row) =>
        row.docsReady ? (
          <Badge variant="light" color="teal" radius="sm">
            ثبت شده
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
      cell: (row) =>
        row.docsReady ? (
          <Badge variant="light" color="teal" radius="sm">
            ثبت شده
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
    {
      key: 'status',
      header: 'وضعیت',
      cardHead: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <PanelList<ReturnListItem>
      rows={rows}
      columns={columns}
      getRowId={(row) => row.id}
      onRowActivate={(row) => router.push(`/returns/${encodeURIComponent(row.displayId)}`)}
      activateLabel={() => 'جزئیات درخواست'}
      detailHref={(row) => `/returns/${encodeURIComponent(row.displayId)}`}
      detailLabel={() => 'جزئیات درخواست'}
      empty={
        filtered
          ? {
              icon: IconSearch,
              message: 'درخواستی با این مشخصات یافت نشد.',
              hint: 'فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید.',
            }
          : {
              icon: IconArrowBackUp,
              message: 'هنوز درخواست مرجوعی ثبت نشده است.',
              hint: 'درخواست‌های مشتریان از سفارش‌های تحویل‌شده همین‌جا می‌آید.',
            }
      }
    />
  );
}
