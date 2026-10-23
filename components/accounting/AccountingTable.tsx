'use client';

import { IconCalculator, IconSearch } from '@tabler/icons-react';
import { Badge, Stack, Text } from '@mantine/core';
import OrderItemsDetail from '@/components/ui/panel/OrderItemsDetail';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import type { OrderAccountDTO } from '@/lib/accounting';
import { enCurrency, enNumber } from '@/lib/format';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/order-status';

export interface AccountingTableProps {
  accounts: OrderAccountDTO[];
  /** فیلتر فعال است — پیام «یافت نشد» به‌جای حالت خالی پیش‌فرض (آیکون سمت
   *  کلاینت انتخاب می‌شود؛ توابع از مرز RSC به کلاینت رد نمی‌شوند). */
  filtered?: boolean;
}

/** سلول پله‌ای دوخطی (مقدار اصلی + ریز‌متن) — ارقام جدولی. */
function StackedCell({ main, sub }: { main: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Stack gap={2}>
      {main}
      {sub ? (
        <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {sub}
        </Text>
      ) : null}
    </Stack>
  );
}

/** نمایش مبلغ یا خط تیره کم‌جان وقتی صفر است. */
function Money({ value, bold = false }: { value: number; bold?: boolean }) {
  if (value <= 0) {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }
  return (
    <Text size="sm" fw={bold ? 700 : 600} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {enCurrency(value, false)}
    </Text>
  );
}

/**
 * لیست حسابداری روی قاعده مشترک PanelList — همان رفتار سفارش‌ها و تحویل
 * حضوری: دسکتاپ آکاردئون اقلام زیر ردیف، موبایل کارت با لینک به صفحه
 * اختصاصی جزئیات. ستون‌های تخفیف و پرداخت پله‌ای تجمیع شده‌اند تا جدول بدون
 * اسکرول افقی در عرض‌های میانی هم می‌نشیند.
 */
export default function AccountingTable({ accounts, filtered = false }: AccountingTableProps) {
  const columns: PanelColumn<OrderAccountDTO>[] = [
    {
      key: 'customer',
      header: 'مشتری',
      cardTitle: true,
      sortValue: (account) => account.customerName,
      card: (account) => account.customerName,
      cell: (account) =>
        StackedCell({
          main: (
            <Text size="sm" fw={500}>
              {account.customerName}
            </Text>
          ),
          sub: account.customerPhone,
        }),
    },
    {
      key: 'order',
      header: 'سفارش',
      sortValue: (account) => account.createdAt.getTime(),
      cell: (account) =>
        StackedCell({
          main: (
            <Text size="sm" ff="monospace" dir="ltr" ta="start">
              {account.displayId}
            </Text>
          ),
          sub: account.date,
        }),
    },
    {
      key: 'delivery',
      header: 'روش تحویل',
      cell: (account) =>
        StackedCell({
          main: (
            <Text size="sm" c={account.deliveryKind === 'pickup' ? 'violet.7' : undefined}>
              {account.deliveryKind === 'pickup' ? 'حضوری' : 'ارسالی'}
            </Text>
          ),
          sub: account.deliveryMethodLabel,
        }),
    },
    {
      key: 'base',
      header: 'قیمت اصلی',
      sortValue: (account) => account.baseAmount,
      cell: (account) => <Money value={account.baseAmount} />,
    },
    {
      key: 'discounts',
      header: 'تخفیف‌ها',
      cell: (account) => {
        const coupon = account.couponCode
          ? `${account.couponCode} −${enCurrency(account.discountAmount, false)}`
          : null;
        if (account.productDiscount <= 0 && !coupon) {
          return (
            <Text size="sm" c="dimmed">
              —
            </Text>
          );
        }
        return (
          <Stack gap={2}>
            {account.productDiscount > 0 ? (
              <Text size="sm" c="orange.7" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                کالا −{enCurrency(account.productDiscount, false)}
              </Text>
            ) : null}
            {coupon ? (
              <Text size="xs" c="orange.7" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {coupon}
              </Text>
            ) : null}
          </Stack>
        );
      },
    },
    {
      key: 'payable',
      header: 'قابل پرداخت',
      sortValue: (account) => account.payable,
      card: (account) => (
        <Text size="sm" fw={700}>
          {enCurrency(account.payable, false)}
        </Text>
      ),
      cell: (account) => <Money value={account.payable} bold />,
    },
    {
      key: 'paid',
      header: 'پرداخت',
      cell: (account) => {
        if (account.onlinePaid <= 0 && account.walletPaid <= 0) {
          return (
            <Text size="sm" c="dimmed">
              —
            </Text>
          );
        }
        return (
          <Stack gap={2}>
            {account.onlinePaid > 0 ? (
              <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                آنلاین {enCurrency(account.onlinePaid, false)}
              </Text>
            ) : null}
            {account.walletPaid > 0 ? (
              <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                کیف پول {enCurrency(account.walletPaid, false)}
              </Text>
            ) : null}
          </Stack>
        );
      },
    },
    {
      key: 'status',
      header: 'وضعیت',
      cardHead: true,
      cell: (account) => (
        <Stack gap={4}>
          <Badge variant="light" color={STATUS_COLORS[account.status]} radius="sm" size="sm">
            {STATUS_LABELS[account.status]}
          </Badge>
          {account.refunded > 0 ? (
            <Text size="xs" c="red" style={{ fontVariantNumeric: 'tabular-nums' }}>
              بازگشت {enCurrency(account.refunded, false)}
            </Text>
          ) : null}
        </Stack>
      ),
    },
  ];

  return (
    <PanelList<OrderAccountDTO>
      rows={accounts}
      columns={columns}
      getRowId={(account) => account.displayId}
      renderDetail={(account) => <OrderItemsDetail items={account.items} />}
      detailHeading={(account) => `اقلام سفارش ${account.displayId} — ${account.customerName}`}
      detailHref={(account) => `/orders/${encodeURIComponent(account.displayId)}/items`}
      detailLabel={(account) => `جزئیات و اقلام سفارش (${enNumber(account.items.length)} قلم)`}
      empty={
        filtered
          ? {
              icon: IconSearch,
              message: 'سفارشی با این مشخصات یافت نشد.',
              hint: 'فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید.',
            }
          : {
              icon: IconCalculator,
              message: 'سفارشی برای نمایش وجود ندارد.',
              hint: 'اولین سفارش حساب‌دار همین‌جا نمایش داده می‌شود.',
            }
      }
    />
  );
}
