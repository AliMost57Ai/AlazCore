'use client';

import { IconCash, IconSearch } from '@tabler/icons-react';
import { Text } from '@mantine/core';
import { MoneyCell } from '@/components/reports/report-cells';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import type { CashFlowRow } from '@/lib/financial-reports';

/** سلول تنظیم ادمین — می‌تواند منفی باشد (برداشت از کیف پول). */
function AdjustCell({ value }: { value: number }) {
  return MoneyCell({ value });
}

/**
 * جدول جریان نقدی روزانه — دفتر درگاه (پول واقعی) و دفتر کیف پول (جابه‌جایی
 * داخلی) کنار هم؛ هدر روشن استاندارد پنل، موبایل کارت.
 */
export default function CashFlowTable({
  rows,
  filtered = false,
}: {
  rows: CashFlowRow[];
  filtered?: boolean;
}) {
  const columns: PanelColumn<CashFlowRow>[] = [
    {
      key: 'day',
      headerHint: 'تاریخ شمسی تراکنش‌های همان روز (درگاه و کیف پول)',
      header: 'روز',
      cardTitle: true,
      cell: (row) => (
        <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {row.label}
        </Text>
      ),
    },
    {
      key: 'gatewayOrders',
      headerHint: 'پرداخت‌های تأییدشده درگاه برای سفارش‌ها',
      header: 'دریافت برای سفارش',
      cell: (row) => MoneyCell({ value: row.gatewayOrders }),
    },
    {
      key: 'gatewayTopUp',
      headerHint:
        'شارژ تأییدشده کیف پول از درگاه — از دفتر درگاه شمرده می‌شود تا در دفتر کیف پول دوبار حساب نشود',
      header: 'شارژ کیف پول',
      cell: (row) => MoneyCell({ value: row.gatewayTopUp }),
    },
    {
      key: 'walletPaid',
      headerHint: 'برداشت کیف پول برای پرداخت سفارش (قدرمطلق)',
      header: 'پرداخت با کیف پول',
      cell: (row) => MoneyCell({ value: row.walletPaid }),
    },
    {
      key: 'walletRefund',
      headerHint: 'بازگشت پول سفارش لغوشدهٔ پرداخت‌شده به کیف پول',
      header: 'بازگشت به کیف پول',
      cell: (row) => MoneyCell({ value: row.walletRefund }),
    },
    {
      key: 'walletAdjust',
      headerHint: 'اصلاح دستی مانده کیف پول توسط ادمین — می‌تواند منفی باشد',
      header: 'تنظیم ادمین',
      cell: (row) => AdjustCell({ value: row.walletAdjust }),
    },
    {
      key: 'cashIn',
      headerHint:
        'دریافت برای سفارش + شارژ کیف پول — پول واقعی واردشده از درگاه؛ پس‌کرایه هنگام تحویل جداگانه وصول می‌شود',
      header: 'جمع ورودی نقدی',
      cardHead: true,
      cell: (row) => MoneyCell({ value: row.cashIn, bold: true }),
    },
  ];

  return (
    <PanelList<CashFlowRow>
      rows={rows}
      columns={columns}
      getRowId={(row) => row.key}
      empty={
        filtered
          ? {
              icon: IconSearch,
              message: 'جابه‌جایی پولی در این بازه ثبت نشده است.',
              hint: 'بازه تاریخ را تغییر دهید یا فیلترها را بردارید.',
            }
          : {
              icon: IconCash,
              message: 'هنوز جابه‌جایی پولی ثبت نشده است.',
              hint: 'اولین پرداخت یا شارژ کیف پول، دفتر نقدی همین‌جا را می‌سازد.',
            }
      }
    />
  );
}
