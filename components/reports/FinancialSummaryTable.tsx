'use client';

import type { ReactNode } from 'react';
import { IconChartBar, IconSearch } from '@tabler/icons-react';
import { Group, Stack, Text } from '@mantine/core';
import { CountCell, MoneyCell } from '@/components/reports/report-cells';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import type { SummaryResult, SummaryRow } from '@/lib/financial-reports';
import { enNumber } from '@/lib/format';

/** دوخطی: برچسب دوره + تعداد سفارش آن دوره. */
function PeriodCell({ row }: { row: SummaryRow }) {
  return (
    <Stack gap={2}>
      <Text size="sm" fw={600}>
        {row.label}
      </Text>
      <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {`${enNumber(row.orders)} سفارش`}
      </Text>
    </Stack>
  );
}

/**
 * جدول خلاصه مالی دوره — سطرها روزانه/ماهانه، هدر روشن استاندارد پنل،
 * موبایل کارت (قاعده واحد PanelList). آیکون حالت خالی سمت کلاینت انتخاب
 * می‌شود (توابع از مرز RSC به کلاینت رد نمی‌شوند).
 */
export default function FinancialSummaryTable({
  rows,
  filtered = false,
}: {
  rows: SummaryRow[];
  filtered?: boolean;
}) {
  const columns: PanelColumn<SummaryRow>[] = [
    {
      key: 'period',
      headerHint: 'برچسب شمسی از خود سفارش؛ گروه‌بندی بر اساس تاریخ ثبت سفارش‌های حساب‌دار',
      header: 'دوره',
      cardTitle: true,
      cell: (row) => <PeriodCell row={row} />,
    },
    {
      key: 'grossList',
      headerHint:
        'جمع قیمتِ لیست اقلام هنگام سفارش (baseAmount)؛ ردیف‌های قدیمیِ بدون این ستون = فروش خالص',
      header: 'فروش لیست',
      cell: (row) => MoneyCell({ value: row.grossList }),
    },
    {
      key: 'discounts',
      headerHint: 'تخفیف کالا (فروش لیست − فروش خالص) + تخفیف کد (discountAmount)',
      header: 'تخفیف‌ها',
      cell: (row) => MoneyCell({ value: row.discounts, danger: true }),
    },
    {
      key: 'shipping',
      headerHint:
        'هزینه ارسال ثبت‌شده در فاکتور (shippingCost)؛ پس‌کرایه هنگام تحویل از مشتری وصول می‌شود',
      header: 'هزینه ارسال',
      cell: (row) => MoneyCell({ value: row.shipping }),
    },
    {
      key: 'net',
      headerHint: 'مبلغ کالاها پس از تخفیف کالا و پیش از تخفیف کد (amount) — مبنای کارمزد',
      header: 'فروش خالص',
      cell: (row) => MoneyCell({ value: row.net, bold: true }),
    },
    {
      key: 'collected',
      headerHint:
        'قابل پرداخت سفارش‌های پرداخت‌شده؛ قابل پرداخت = فروش خالص − تخفیف کد + هزینه ارسال',
      header: 'وصول‌شده',
      cell: (row) => MoneyCell({ value: row.collected }),
    },
    {
      key: 'outstanding',
      headerHint:
        'قابل پرداخت سفارش‌های هنوز پرداخت‌نشده — لینک پرداخت باز، پرداخت ناموفق یا پس‌کرایه',
      header: 'در انتظار تسویه',
      cell: (row) => MoneyCell({ value: row.outstanding, danger: true }),
    },
    {
      key: 'commission',
      headerHint: 'فروش خالص × درصد پورسانت لایسنس بک‌آفیس کور',
      header: 'کارمزد',
      cell: (row) => MoneyCell({ value: row.commission, danger: true }),
    },
    {
      key: 'ownerNet',
      headerHint: 'فروش خالص − کارمزد',
      header: 'خالص مالک',
      cardHead: true,
      cell: (row) => MoneyCell({ value: row.ownerNet, bold: true }),
    },
  ];

  return (
    <PanelList<SummaryRow>
      rows={rows}
      columns={columns}
      getRowId={(row) => row.key}
      empty={
        filtered
          ? {
              icon: IconSearch,
              message: 'دوره‌ای با این فیلترها یافت نشد.',
              hint: 'بازه تاریخ یا فیلترها را تغییر دهید.',
            }
          : {
              icon: IconChartBar,
              message: 'هنوز فروشی ثبت نشده است.',
              hint: 'با اولین سفارش، خلاصه مالی همین‌جا ساخته می‌شود.',
            }
      }
    />
  );
}

/** نوار جمع کل بالای جدول خلاصه — همان اعداد سطرها، بدون ستون دوره. */
export function SummaryTotals({ totals }: { totals: SummaryResult['totals'] }) {
  const items: { label: string; node: ReactNode }[] = [
    { label: 'سفارش‌ها', node: <CountCell value={totals.orders} /> },
    { label: 'فروش لیست', node: MoneyCell({ value: totals.grossList }) },
    { label: 'تخفیف‌ها', node: MoneyCell({ value: totals.discounts, danger: true }) },
    { label: 'فروش خالص', node: MoneyCell({ value: totals.net, bold: true }) },
    { label: 'وصول‌شده', node: MoneyCell({ value: totals.collected }) },
    { label: 'در انتظار تسویه', node: MoneyCell({ value: totals.outstanding, danger: true }) },
    { label: 'کارمزد', node: MoneyCell({ value: totals.commission, danger: true }) },
    { label: 'خالص مالک', node: MoneyCell({ value: totals.ownerNet, bold: true }) },
  ];

  return (
    <Group gap="xl" wrap="wrap" mb="md">
      {items.map((item) => (
        <Stack key={item.label} gap={2}>
          <Text size="xs" c="dimmed">
            {item.label}
          </Text>
          {item.node}
        </Stack>
      ))}
    </Group>
  );
}
