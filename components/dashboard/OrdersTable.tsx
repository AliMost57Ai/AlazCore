'use client';

import {
  IconAlertTriangle,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconPackage,
  IconSearch,
  IconShoppingCart,
  IconTruck,
} from '@tabler/icons-react';
import { Badge, Stack, Text } from '@mantine/core';
import FulfillmentControls from '@/components/orders/FulfillmentControls';
import OrderItemsDetail from '@/components/ui/panel/OrderItemsDetail';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import { enCurrency, enNumber } from '@/lib/format';
import { STATUS_COLORS, STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import type { Order } from '@/lib/orders';

const STATUS_ICONS: Record<OrderStatus, typeof IconCheck> = {
  paid: IconCheck,
  pending: IconClock,
  boxing: IconPackage,
  posted: IconTruck,
  shipped: IconTruck,
  delivered: IconCircleCheck,
  cancelled: IconAlertTriangle,
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const Icon = STATUS_ICONS[status];

  return (
    // Icon + text, never colour alone: `pending` (yellow) sits under 3:1 on a
    // light surface, so the label is what actually carries the state.
    <Badge
      variant="light"
      color={STATUS_COLORS[status]}
      leftSection={<Icon size={12} stroke={2.5} />}
      radius="sm"
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export interface OrdersTableProps {
  /** Rows to show — the server page slices/queries as needed. */
  orders: Order[];
  /** Renders the fulfillment actions (boxing → posted → notice) for roles
   *  with the orders:edit grant — the API enforces it regardless. */
  canEdit?: boolean;
  /** فیلتر فعال است — پیام «یافت نشد» به‌جای «هنوز سفارشی ثبت نشده». آیکون
   *  سمت کلاینت انتخاب می‌شود چون توابع از مرز RSC به کلاینت رد نمی‌شوند. */
  filtered?: boolean;
}

/**
 * جدول سفارش‌ها روی قاعده مشترک PanelList — تک رفتار با تحویل حضوری و
 * حسابداری: دسکتاپ آکاردئون اقلام زیر ردیف، موبایل کارت با لینک به صفحه
 * اختصاصی جزئیات (/orders/[id]/items). ستون‌ها فقط تعریف می‌شوند؛ رفتار
 * (آکاردئون، کارت، حالت خالی، stopPropagation عملیات) از PanelList می‌آید.
 */
export default function OrdersTable({
  orders,
  canEdit = false,
  filtered = false,
}: OrdersTableProps) {
  const columns: PanelColumn<Order>[] = [
    {
      key: 'customer',
      header: 'مشتری',
      cardTitle: true,
      sortValue: (order) => order.customer,
      card: (order) => order.customer,
      cell: (order) => (
        <Text size="sm" fw={500}>
          {order.customer}
        </Text>
      ),
    },
    {
      key: 'id',
      header: 'شناسه سفارش',
      sortValue: (order) => order.id,
      cell: (order) => (
        <Text size="sm" ff="monospace" dir="ltr" ta="start">
          {order.id}
        </Text>
      ),
    },
    {
      key: 'date',
      header: 'تاریخ',
      sortValue: (order) => order.createdAt.getTime(),
      cell: (order) => (
        <Text size="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {order.date}
        </Text>
      ),
    },
    {
      key: 'amount',
      header: 'مبلغ',
      sortValue: (order) => order.amount,
      card: (order) => (
        <Text size="sm" fw={700}>
          {enCurrency(order.amount, false)}
        </Text>
      ),
      cell: (order) => (
        <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {enCurrency(order.amount, false)}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'وضعیت',
      cardHead: true,
      cell: (order) => (
        <Stack gap={4}>
          <StatusBadge status={order.status} />
          {/* پرچم خالی‌فروشی از خود سفارش می‌آید — سفارش‌های در انتظار
              تامین موجودی راهنمای اقدام هم می‌گیرند. */}
          {order.oversell ? (
            <Badge variant="light" color="orange" radius="sm" size="sm">
              خالی‌فروشی
            </Badge>
          ) : null}
          {order.oversellBlocked ? (
            <Text size="xs" c="orange.7">
              نیازمند افزایش موجودی
            </Text>
          ) : null}
          {order.trackingCode ? (
            <Text size="xs" ff="monospace" dir="ltr" ta="start" c="dimmed">
              {order.trackingCode}
            </Text>
          ) : null}
        </Stack>
      ),
    },
  ];

  return (
    <PanelList<Order>
      rows={orders}
      columns={columns}
      getRowId={(order) => order.id}
      renderDetail={(order) => (
        <OrderItemsDetail
          items={order.items}
          remove={
            canEdit && (order.status === 'paid' || order.status === 'boxing')
              ? { orderDisplayId: order.id, status: order.status }
              : undefined
          }
        />
      )}
      detailHeading={(order) => `اقلام سفارش ${order.id} — ${order.customer}`}
      detailHref={(order) => `/orders/${encodeURIComponent(order.id)}/items`}
      detailLabel={(order) => `اقلام سفارش (${enNumber(order.items.length)} قلم)`}
      renderActions={canEdit ? (order) => <FulfillmentControls order={order} /> : undefined}
      empty={
        filtered
          ? {
              icon: IconSearch,
              message: 'سفارشی با این مشخصات یافت نشد.',
              hint: 'فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید.',
            }
          : {
              icon: IconShoppingCart,
              message: 'هنوز سفارشی ثبت نشده است.',
              hint: 'اولین سفارش فروشگاه همین‌جا نمایش داده می‌شود.',
            }
      }
    />
  );
}
