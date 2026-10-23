'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconBan, IconClipboardList } from '@tabler/icons-react';
import { Badge, Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  cancelPickupOrder,
  markPickupDelivered,
  notifyPickupCustomer,
} from '@/components/orders/pickup-api';
import PickupRescheduleForm from '@/components/orders/PickupRescheduleForm';
import OrderItemsDetail from '@/components/ui/panel/OrderItemsDetail';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import ResponsiveModal from '@/components/ui/panel/ResponsiveModal';
import { enCurrency, enNumber } from '@/lib/format';
import { STATUS_COLORS, STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import type { PickupOrderDTO } from '@/lib/pickup';

function isOrderStatus(status: string): status is OrderStatus {
  return (
    status === 'paid' ||
    status === 'pending' ||
    status === 'boxing' ||
    status === 'posted' ||
    status === 'shipped' ||
    status === 'delivered' ||
    status === 'cancelled'
  );
}

/** سفارش پرداخت‌نشده تحویل‌شدنی نیست — فقط وضعیت‌های بعد از پرداخت. */
const DELIVERABLE: OrderStatus[] = ['paid', 'boxing', 'posted', 'shipped'];
/** وضعیت‌های نهایی قابل لغو/تغییر برنامه نیستند. */
const TERMINAL: OrderStatus[] = ['delivered', 'cancelled'];

export interface PickupOrdersTableProps {
  orders: PickupOrderDTO[];
  /** عملیات فقط با دسترسی /orders/pickup:edit — API هم دوباره چک می‌کند. */
  canDeliver: boolean;
}

/**
 * جدول سفارش‌های تحویل حضوری روی قاعده مشترک PanelList. دسکتاپ: آکاردئون
 * اقلام + عملیات با مودال. موبایل: کارت + لینک به صفحات اختصاصی — «تغییر
 * زمان» و «لغو» در موبایل مودال باز نمی‌کنند، صفحه باز می‌کنند (قاعده پنل:
 * نه مودال نه آکاردئون در موبایل)؛ «تحویل شد» و «اطلاع‌رسانی» عملِ بی‌فرم
 * هستند و دکمه می‌مانند.
 */
export default function PickupOrdersTable({ orders, canDeliver }: PickupOrdersTableProps) {
  const router = useRouter();
  const [delivering, setDelivering] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<PickupOrderDTO | null>(null);
  const [rescheduling, setRescheduling] = useState<PickupOrderDTO | null>(null);
  const [notifying, setNotifying] = useState<string | null>(null);

  async function markDelivered(order: PickupOrderDTO) {
    setDelivering(order.id);
    const result = await markPickupDelivered(order.id);
    setDelivering(null);
    if (!result.ok) {
      notifications.show({ title: 'خطا', message: result.error, color: 'red' });
      return;
    }
    notifications.show({
      message: `سفارش ${order.displayId} تحویل مشتری داده شد.`,
      color: 'green',
    });
    router.refresh();
  }

  async function cancelOrder(order: PickupOrderDTO) {
    const result = await cancelPickupOrder(order.id);
    if (!result.ok) {
      notifications.show({ title: 'خطا', message: result.error, color: 'red' });
      return;
    }
    notifications.show({
      message:
        result.refunded > 0
          ? `سفارش ${order.displayId} لغو شد و ${enCurrency(result.refunded, false)} به کیف پول مشتری برگشت.`
          : `سفارش ${order.displayId} لغو شد.`,
      color: 'green',
    });
    setCancelling(null);
    router.refresh();
  }

  async function notify(order: PickupOrderDTO) {
    setNotifying(order.id);
    const result = await notifyPickupCustomer(order.id);
    setNotifying(null);
    if (!result.ok) {
      notifications.show({ title: 'خطا', message: result.error, color: 'red' });
      return;
    }
    notifications.show({
      message: `پیامک برنامه تحویل برای مشتری سفارش ${order.displayId} ارسال شد.`,
      color: 'green',
    });
  }

  const statusBadge = (status: string) => (
    <Badge
      variant="light"
      color={isOrderStatus(status) ? STATUS_COLORS[status] : 'gray'}
      radius="sm"
    >
      {isOrderStatus(status) ? STATUS_LABELS[status] : status}
    </Badge>
  );

  /** دکمه‌های مشترک بی‌فرم — دسکتاپ و موبایل یکسان؛ فشرده تا ستون عملیات
   *  جدول دسکتاپ سرریز نکند (آیکن‌ها حذف، متن کوتاه). */
  const instantActions = (order: PickupOrderDTO, deliverable: boolean, editable: boolean) => (
    <>
      {deliverable ? (
        <Button
          size="compact-sm"
          variant="light"
          color="teal"
          loading={delivering === order.id}
          onClick={() => void markDelivered(order)}
        >
          تحویل شد
        </Button>
      ) : null}
      {editable ? (
        <Button
          size="compact-sm"
          variant="light"
          color="blue"
          loading={notifying === order.id}
          onClick={() => void notify(order)}
        >
          اطلاع‌رسانی
        </Button>
      ) : null}
    </>
  );

  /** عملیات دسکتاپ — فرم‌ها مودال. */
  const actions = (order: PickupOrderDTO) => {
    if (!canDeliver) {
      return null;
    }
    const status = isOrderStatus(order.status) ? order.status : null;
    const deliverable = status !== null && DELIVERABLE.includes(status);
    const editable = status !== null && !TERMINAL.includes(status);
    return (
      /* عرض مهارشده تا دکمه‌ها در عرض‌های میانی دوخطی شوند و جدول سرریز نکند. */
      <Group gap="xxs" wrap="wrap" w={172}>
        {instantActions(order, deliverable, editable)}
        {editable ? (
          <Button
            size="compact-sm"
            variant="light"
            color="brand"
            onClick={() => setRescheduling(order)}
          >
            تغییر زمان
          </Button>
        ) : null}
        {editable ? (
          <Button
            size="compact-sm"
            variant="light"
            color="red"
            onClick={() => setCancelling(order)}
          >
            لغو
          </Button>
        ) : null}
      </Group>
    );
  };

  /** عملیات موبایل — فرم‌ها صفحه اختصاصی (لینک)، عمل‌های بی‌فرم دکمه. */
  const mobileActions = (order: PickupOrderDTO) => {
    if (!canDeliver) {
      return null;
    }
    const status = isOrderStatus(order.status) ? order.status : null;
    const deliverable = status !== null && DELIVERABLE.includes(status);
    const editable = status !== null && !TERMINAL.includes(status);
    return (
      <Group gap="xs" wrap="wrap">
        {instantActions(order, deliverable, editable)}
        {editable ? (
          <Button
            component={Link}
            href={`/orders/${encodeURIComponent(order.displayId)}/pickup-reschedule`}
            size="compact-sm"
            variant="light"
            color="brand"
          >
            تغییر زمان
          </Button>
        ) : null}
        {editable ? (
          <Button
            component={Link}
            href={`/orders/${encodeURIComponent(order.displayId)}/pickup-cancel`}
            size="compact-sm"
            variant="light"
            color="red"
          >
            لغو
          </Button>
        ) : null}
      </Group>
    );
  };

  const columns: PanelColumn<PickupOrderDTO>[] = [
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
      sortValue: (order) => order.displayId,
      cell: (order) => (
        <Text size="sm" ff="monospace" dir="ltr" ta="start">
          {order.displayId}
        </Text>
      ),
    },
    {
      key: 'location',
      header: 'نقطه و زمان تحویل',
      sortValue: (order) => order.pickupDate,
      cell: (order) => (
        <Stack gap={2}>
          <Text size="sm">{order.locationTitle}</Text>
          <Text size="xs" c="dimmed">
            {order.pickupDateLabel} — {order.slotLabel}
          </Text>
        </Stack>
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
          {statusBadge(order.status)}
          {order.changeNote ? (
            <Badge variant="outline" color="orange" size="sm">
              تغییر کرده
            </Badge>
          ) : null}
        </Stack>
      ),
    },
  ];

  return (
    <>
      <PanelList<PickupOrderDTO>
        rows={orders}
        columns={columns}
        getRowId={(order) => order.displayId}
        renderDetail={(order) => (
          <Stack gap="sm">
            <OrderItemsDetail items={order.items} />
            <Stack gap={4}>
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Text size="xs" c="dimmed">
                  آدرس تحویل حضوری
                </Text>
                <Text size="xs">
                  {order.locationTitle} — {order.locationAddress}
                </Text>
              </Group>
              {order.changeNote ? (
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <Text size="xs" c="dimmed">
                    آخرین تغییر برنامه ({order.changeAt})
                  </Text>
                  <Text size="xs" c="orange.7">
                    {order.changeNote}
                  </Text>
                </Group>
              ) : null}
            </Stack>
          </Stack>
        )}
        detailHeading={(order) => `اقلام سفارش ${order.displayId} — ${order.customer}`}
        // شناسه لینک باید displayId باشد (صفحه جزئیات با displayId حل می‌کند)
        detailHref={(order) => `/orders/${encodeURIComponent(order.displayId)}/items`}
        detailLabel={(order) => `اقلام سفارش (${enNumber(order.items.length)} قلم)`}
        renderActions={canDeliver ? actions : undefined}
        renderMobileActions={canDeliver ? mobileActions : undefined}
        empty={{
          icon: IconClipboardList,
          message: 'سفارش تحویل حضوری با این مشخصات یافت نشد.',
          hint: 'فیلترها را تغییر دهید یا روز دیگری را انتخاب کنید.',
        }}
      />

      {/* مودال تأیید لغو — فقط دسکتاپ؛ موبایل صفحه /pickup-cancel را دارد. */}
      <ResponsiveModal
        opened={cancelling !== null}
        onClose={() => setCancelling(null)}
        title="لغو سفارش تحویل حضوری"
      >
        <Stack gap="sm">
          <Text size="sm">
            سفارش {cancelling?.displayId} لغو شود؟ رزرو تحویل حضوری آن آزاد می‌شود
            {cancelling?.status !== 'pending'
              ? ' و مبلغ پرداخت‌شده به کیف پول مشتری برگشت داده می‌شود'
              : ''}
            .
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setCancelling(null)}>
              انصراف
            </Button>
            <Button
              color="red"
              leftSection={<IconBan size={16} />}
              onClick={() => {
                if (cancelling) {
                  void cancelOrder(cancelling);
                }
              }}
            >
              لغو سفارش
            </Button>
          </Group>
        </Stack>
      </ResponsiveModal>

      {rescheduling ? (
        <ResponsiveModal
          opened
          onClose={() => setRescheduling(null)}
          title={`تغییر تاریخ و ساعت تحویل — ${rescheduling.displayId}`}
          size="lg"
        >
          <PickupRescheduleForm
            order={rescheduling}
            onCancel={() => setRescheduling(null)}
            onDone={() => {
              setRescheduling(null);
              router.refresh();
            }}
          />
        </ResponsiveModal>
      ) : null}
    </>
  );
}
