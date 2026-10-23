'use client';

import { IconSearch, IconTicket } from '@tabler/icons-react';
import { Badge, Text } from '@mantine/core';
import { CountCell, MoneyCell } from '@/components/reports/report-cells';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import type { CouponReportRow } from '@/lib/financial-reports';
import { enPercent } from '@/lib/format';

function StatusBadge(row: CouponReportRow) {
  if (row.isActive === null) {
    return (
      <Badge variant="light" color="gray" radius="sm" size="sm">
        حذف‌شده
      </Badge>
    );
  }
  if (row.isExpired) {
    return (
      <Badge variant="light" color="dark.4" radius="sm" size="sm">
        منقضی
      </Badge>
    );
  }
  return row.isActive ? (
    <Badge variant="light" color="teal" radius="sm" size="sm">
      فعال
    </Badge>
  ) : (
    <Badge variant="light" color="red" radius="sm" size="sm">
      غیرفعال
    </Badge>
  );
}

/** جدول عملکرد کدهای تخفیف — هدر روشن استاندارد پنل، موبایل کارت. */
export default function CouponReportTable({
  rows,
  filtered = false,
}: {
  rows: CouponReportRow[];
  filtered?: boolean;
}) {
  const columns: PanelColumn<CouponReportRow>[] = [
    {
      key: 'code',
      headerHint: 'کد ثبت‌شده روی سفارش‌ها (couponCode)',
      header: 'کد تخفیف',
      cardTitle: true,
      cell: (row) => (
        <Text size="sm" fw={600} ff="monospace" dir="ltr" ta="start">
          {row.code}
        </Text>
      ),
    },
    {
      key: 'status',
      headerHint:
        'فعال/غیرفعال/منقضی از جدول کدهای تخفیف؛ «حذف‌شده» یعنی کد دیگر وجود ندارد و فقط ردپایش در سفارش‌هاست',
      header: 'وضعیت',
      cardHead: true,
      cell: (row) => StatusBadge(row),
    },
    {
      key: 'uses',
      headerHint:
        'شمار رستمی یکتا در ledger کدهای تخفیف (CouponRedemption) — هر مشتری حداکثر یک بار',
      header: 'استفاده (نفر)',
      cell: (row) => CountCell({ value: row.uses }),
    },
    {
      key: 'orders',
      headerHint: 'تعداد سفارش‌های حساب‌دار با این کد در بازه',
      header: 'سفارش',
      cell: (row) => CountCell({ value: row.orders }),
    },
    {
      key: 'customers',
      headerHint: 'تعداد کاربران متمایز همان سفارش‌ها',
      header: 'مشتری یکتا',
      cell: (row) => CountCell({ value: row.customers }),
    },
    {
      key: 'sales',
      headerHint: 'جمع مبلغ سفارش‌های دارای کد (amount)',
      header: 'فروش با تخفیف',
      cell: (row) => MoneyCell({ value: row.sales }),
    },
    {
      key: 'discount',
      headerHint: 'جمع تخفیفِ اعمال‌شده با کد (discountAmount)',
      header: 'تخفیف داده‌شده',
      cell: (row) => MoneyCell({ value: row.discount, danger: true }),
    },
    {
      key: 'share',
      headerHint: 'تخفیف داده‌شده ÷ فروش با تخفیف × ۱۰۰',
      header: 'سهم تخفیف',
      cell: (row) =>
        row.share > 0 ? (
          <Text size="sm" c="orange.7" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {enPercent(row.share)}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
    {
      key: 'lastUsed',
      headerHint: 'تاریخ شمسی جدیدترین سفارش با این کد',
      header: 'آخرین استفاده',
      cell: (row) =>
        row.lastUsed ? (
          <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {row.lastUsed}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
  ];

  return (
    <PanelList<CouponReportRow>
      rows={rows}
      columns={columns}
      getRowId={(row) => row.code}
      empty={
        filtered
          ? {
              icon: IconSearch,
              message: 'کد تخفیفی در این بازه استفاده نشده است.',
              hint: 'بازه تاریخ را تغییر دهید یا فیلترها را بردارید.',
            }
          : {
              icon: IconTicket,
              message: 'هنوز کد تخفیفی استفاده نشده است.',
              hint: 'با اولین خرید با کد تخفیف، عملکرد همین‌جا گزارش می‌شود.',
            }
      }
    />
  );
}
