'use client';

import { IconCoins, IconSearch } from '@tabler/icons-react';
import { Stack, Text } from '@mantine/core';
import { MoneyCell } from '@/components/reports/report-cells';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import type { CommissionRow } from '@/lib/financial-reports';
import { enNumber } from '@/lib/format';

/**
 * جدول کارمزد AlazCore — سطر ماهانه با درصد پورسانت لایسنس در سربرگ ستون
 * کارمزد؛ کارمزد صفر (بدون لایسنس) باز هم درست نمایش داده می‌شود.
 */
export default function CommissionTable({
  rows,
  percent,
  filtered = false,
}: {
  rows: CommissionRow[];
  /** درصد نمایشی سربرگ — null = بدون درصد در سربرگ. */
  percent: number | null;
  filtered?: boolean;
}) {
  const columns: PanelColumn<CommissionRow>[] = [
    {
      key: 'month',
      headerHint: 'ماه تقویم شمسی از تاریخ ثبت سفارش',
      header: 'ماه',
      cardTitle: true,
      cell: (row) => (
        <Stack gap={2}>
          <Text size="sm" fw={600}>
            {row.label}
          </Text>
          <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {`${enNumber(row.orders)} سفارش`}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'sales',
      headerHint: 'جمع فروش خالص سفارش‌های مؤثر همان ماه (غیر در انتظار و لغوشده)',
      header: 'فروش مشمول',
      cell: (row) => MoneyCell({ value: row.sales }),
    },
    {
      key: 'commission',
      headerHint: 'فروش مشمول × درصد پورسانت — درصد از لایسنس بک‌آفیس کور خوانده می‌شود',
      header: percent !== null ? `کارمزد (${enNumber(percent)}٪)` : 'کارمزد',
      cell: (row) => MoneyCell({ value: row.commission, danger: true }),
    },
    {
      key: 'ownerNet',
      headerHint: 'فروش مشمول − کارمزد',
      header: 'خالص مالک',
      cardHead: true,
      cell: (row) => MoneyCell({ value: row.ownerNet, bold: true }),
    },
  ];

  return (
    <PanelList<CommissionRow>
      rows={rows}
      columns={columns}
      getRowId={(row) => row.key}
      empty={
        filtered
          ? {
              icon: IconSearch,
              message: 'فروشی با این فیلترها یافت نشد.',
              hint: 'بازه تاریخ را تغییر دهید یا فیلترها را بردارید.',
            }
          : {
              icon: IconCoins,
              message: 'هنوز فروش مؤثری ثبت نشده است.',
              hint: 'کارمزد هر ماه پس از اولین فروش مؤثر همین‌جا گزارش می‌شود.',
            }
      }
    />
  );
}
