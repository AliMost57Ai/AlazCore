'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  IconArrowBackUp,
  IconBuildingStore,
  IconCircleCheck,
  IconCreditCard,
  IconFileText,
  IconPackage,
  IconTruck,
} from '@tabler/icons-react';
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Stepper,
  StepperStep,
  Tabs,
  Text,
} from '@mantine/core';
import { faCurrency, faJalaliLongDate, faNumber } from '@/lib/format';
import {
  CURRENT_EVENT_LABELS,
  DELIVERY_SUB_STATUS_LABELS,
  NEXT_STEP_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type DeliverySubStatus,
} from '@/lib/order-status';
import {
  RETURN_STATUS_COLORS,
  RETURN_STATUS_LABELS,
  type ReturnStatus,
} from '@/lib/return-status';
import type { CustomerOrder } from '@/lib/shop-orders';

export interface OrdersSectionProps {
  orders: CustomerOrder[];
}

/** Delivery estimate: Tipax promises at least 3 days after payment. */
const DELIVERY_DAYS = 3;

function estimateFor(order: CustomerOrder): string {
  const base = order.paidAt ?? null;
  if (!base) {
    return '—';
  }
  const eta = new Date(base);
  eta.setDate(eta.getDate() + DELIVERY_DAYS);
  return faJalaliLongDate(eta);
}

/**
 * Sub-status derived from the order status — the fine-grained courier state
 * shown on the tracking card.
 */
function subStatusOf(order: CustomerOrder): DeliverySubStatus | null {
  if (order.status === 'delivered') {
    return 'delivered';
  }
  if (order.status === 'cancelled') {
    return 'cancelled';
  }
  if (order.status === 'paid') {
    return 'seller';
  }
  if (order.status === 'boxing' || order.status === 'posted' || order.status === 'shipped') {
    return 'stage2';
  }
  return null;
}

/** رویداد جاری سفارش تحویل حضوری — مفاهیم پستی (تیپاکس/بسته‌بندی) نداریم. */
function pickupEventOf(order: CustomerOrder): string {
  switch (order.status) {
    case 'pending':
      return 'در انتظار پرداخت';
    case 'paid':
      return 'پرداخت شد — منتظر مراجعه شما';
    case 'delivered':
      return 'تحویل حضوری انجام شد';
    case 'cancelled':
      return 'لغو شده';
    default:
      return 'آماده‌سازی سفارش';
  }
}

/** مراحل سفارش پستی — زنجیره وضعیت‌ها با برچسب کوتاه برای استپر کارت. */
const COURIER_STEPS = [
  { label: 'پرداخت', icon: IconCreditCard },
  { label: 'بسته‌بندی', icon: IconPackage },
  { label: 'تیپاکس', icon: IconTruck },
  { label: 'تحویل', icon: IconCircleCheck },
] as const;

/** مراحل تحویل حضوری — بدون حلقه پستی. */
const PICKUP_STEPS = [
  { label: 'پرداخت', icon: IconCreditCard },
  { label: 'مراجعه به فروشگاه', icon: IconBuildingStore },
  { label: 'تحویل حضوری', icon: IconCircleCheck },
] as const;

function courierStepIndex(status: CustomerOrder['status']): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'paid':
    case 'boxing':
      return 1;
    case 'posted':
    case 'shipped':
      return 2;
    default:
      return COURIER_STEPS.length;
  }
}

function pickupStepIndex(status: CustomerOrder['status']): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'paid':
      return 1;
    case 'delivered':
      return PICKUP_STEPS.length;
    default:
      return 1;
  }
}

/**
 * نمایش مراحل سفارش روی کارت — مثل «مراحل درخواست» صفحه مرجوعی؛ استپر افقی
 * با جایگاه فعلی. سفارش لغوشده مراحلی برای نشان‌دادن ندارد.
 */
function OrderSteps({ order }: { order: CustomerOrder }) {
  if (order.status === 'cancelled') {
    return null;
  }
  const isPickup = Boolean(order.pickup);
  const steps = isPickup ? PICKUP_STEPS : COURIER_STEPS;
  const active = isPickup ? pickupStepIndex(order.status) : courierStepIndex(order.status);
  return (
    <Stepper active={active} color="brand" size="sm" iconSize={26} mb={6}>
      {steps.map((step) => (
        <StepperStep key={step.label} label={step.label} icon={<step.icon size={14} />} />
      ))}
    </Stepper>
  );
}

/** One labelled row of the tracking details. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="xs" wrap="nowrap">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="xs" fw={500} style={{ whiteSpace: 'nowrap' }}>
        {value}
      </Text>
    </Group>
  );
}

/** The full tracking card for one order — details per the panel design. */
function OrderDetailCard({ order }: { order: CustomerOrder }) {
  const sub = subStatusOf(order);
  const isCurrent = order.status !== 'delivered' && order.status !== 'cancelled';
  // آخرین درخواست مرجوعی سفارش (جدیدترین اول) — بج وضعیت + لینک پیگیری.
  const latestReturn = order.returnWindow?.requests?.[0] ?? null;
  // فاکتور از مرحلهٔ پرداخت به بعد معنی دارد — نه سبد پرداخت‌نشده، نه لغوشده.
  const invoiceEligible =
    order.status === 'paid' ||
    order.status === 'boxing' ||
    order.status === 'posted' ||
    order.status === 'shipped' ||
    order.status === 'delivered';

  return (
    <Card withBorder padding="md">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Group gap="xs" wrap="nowrap">
            <Badge variant="light" color={STATUS_COLORS[order.status]} radius="sm">
              {STATUS_LABELS[order.status]}
            </Badge>
            {isCurrent ? (
              <Badge variant="outline" color="gray" radius="sm" size="sm">
                جاری
              </Badge>
            ) : null}
          </Group>
          <Text ff="monospace" fz="sm" fw={600}>
            {order.displayId}
          </Text>
        </Group>

        <Divider />

        <OrderSteps order={order} />

        {order.pickup && order.pickupChange ? (
          <Text size="xs" c="orange.7">
            برنامه تحویل توسط فروشگاه تغییر کرد — علت: {order.pickupChange.note}
            {order.pickupChange.atLabel ? ` (${order.pickupChange.atLabel})` : ''}
          </Text>
        ) : null}

        {/* پیام فروشگاه روی سفارش — علت لغو، توضیح حذف قلم و… */}
        {order.shopNote ? (
          <Text size="xs" c="blue.7">
            پیام فروشگاه: {order.shopNote}
          </Text>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={{ base: 4, sm: 'lg' }}>
          <Stack gap={6}>
            <DetailRow
              label="آخرین رویداد"
              value={
                order.pickup ? pickupEventOf(order) : (CURRENT_EVENT_LABELS[order.status] ?? '—')
              }
            />
            {order.pickup ? null : (
              <DetailRow label="زیر وضعیت" value={sub ? DELIVERY_SUB_STATUS_LABELS[sub] : '—'} />
            )}
            <DetailRow label="تاریخ سفارش" value={order.date} />
            {order.pickup ? (
              <DetailRow
                label="آدرس تحویل حضوری"
                value={`${order.pickup.locationTitle} — ${order.pickup.address}`}
              />
            ) : (
              <DetailRow label="کد رهگیری" value={order.trackingCode ?? '—'} />
            )}
          </Stack>

          <Stack gap={6}>
            <DetailRow label="مبلغ کل" value={faCurrency(order.amount, false)} />
            {order.pickup ? null : (
              <DetailRow
                label="بسته"
                value={`${faNumber(order.packageIndex)} از ${faNumber(order.packageCount)}`}
              />
            )}
            <DetailRow
              label="گام بعدی"
              value={
                order.pickup
                  ? order.status === 'delivered'
                    ? 'تحویل داده شد'
                    : order.status === 'cancelled'
                      ? '—'
                      : `${order.pickup.dateLabel}، ${order.pickup.slotLabel}`
                  : (NEXT_STEP_LABELS[order.status] ?? '—')
              }
            />
            {order.pickup ? null : (
              <DetailRow
                label="تحویل تخمینی"
                value={
                  order.status === 'delivered'
                    ? 'تحویل داده شد'
                    : order.status === 'cancelled'
                      ? '—'
                      : order.estimatedArrival
                        ? faJalaliLongDate(order.estimatedArrival)
                        : estimateFor(order)
                }
              />
            )}
          </Stack>
        </SimpleGrid>

        <Divider />

        <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
          <Stack gap={2} style={{ minWidth: 180 }}>
            {order.items.map((item) => (
              <Text
                key={`${order.id}-${item.productId}-${item.variantId ?? 'base'}`}
                size="xs"
                c="dimmed"
              >
                {item.name} × {faNumber(item.qty)}
              </Text>
            ))}
          </Stack>

          <Stack gap={6} align="flex-end">
            {order.status === 'pending' ? (
              <>
                <Text size="xs" c="dimmed">
                  برای رهگیری، ابتدا سفارش را پرداخت کنید.
                </Text>
                <Button
                  component={Link}
                  href={`/checkout?order=${encodeURIComponent(order.displayId)}`}
                  size="sm"
                  leftSection={<IconCreditCard size={16} />}
                  aria-label={`پرداخت سفارش ${order.displayId}`}
                >
                  پرداخت سفارش
                </Button>
              </>
            ) : null}

            {/* پیگیری مرجوعی — آخرین درخواست ثبت‌شدهٔ این سفارش با وضعیت فعلی. */}
            {latestReturn ? (
              <>
                <Badge
                  variant="light"
                  color={RETURN_STATUS_COLORS[latestReturn.status as ReturnStatus] ?? 'gray'}
                  radius="sm"
                >
                  مرجوعی:{' '}
                  {RETURN_STATUS_LABELS[latestReturn.status as ReturnStatus] ??
                    latestReturn.status}
                </Badge>
                <Button
                  component={Link}
                  href={`/account/returns/${encodeURIComponent(latestReturn.displayId)}`}
                  size="sm"
                  variant="light"
                  leftSection={<IconArrowBackUp size={16} />}
                  aria-label={`پیگیری مرجوعی سفارش ${order.displayId}`}
                >
                  پیگیری مرجوعی
                </Button>
              </>
            ) : null}

            {/* فاکتور فروش — از مرحلهٔ پرداخت به بعد زیر هر سفارش. */}
            {invoiceEligible ? (
              <Button
                component={Link}
                href={`/account/orders/${encodeURIComponent(order.displayId)}/invoice`}
                size="sm"
                variant="light"
                leftSection={<IconFileText size={16} />}
                aria-label={`نمایش فاکتور سفارش ${order.displayId}`}
              >
                نمایش فاکتور
              </Button>
            ) : null}

            {order.status === 'delivered' && !latestReturn ? (
              order.returnWindow?.canRequest ? (
                <>
                  <Text size="xs" c="dimmed">
                    تا{' '}
                    {order.returnWindow.windowEndsAt
                      ? faJalaliLongDate(order.returnWindow.windowEndsAt)
                      : '—'}{' '}
                    فرصت ثبت درخواست مرجوعی دارید.
                  </Text>
                  <Button
                    component={Link}
                    href={`/account/returns/new?order=${encodeURIComponent(order.displayId)}`}
                    size="sm"
                    variant="light"
                    leftSection={<IconArrowBackUp size={16} />}
                    aria-label={`درخواست مرجوعی سفارش ${order.displayId}`}
                  >
                    درخواست مرجوعی
                  </Button>
                </>
              ) : (
                <IconCircleCheck size={20} style={{ color: 'var(--mantine-color-green-6)' }} />
              )
            ) : null}
          </Stack>
        </Group>
      </Stack>
    </Card>
  );
}

/**
 * The customer's order history, grouped into four tabs: «جاری» tracks orders
 * until they're delivered, «تحویل شده» is the delivered archive, «مرجوعی»
 * gathers orders with return requests and «لغو شده» holds orders the shop
 * cancelled. Pending orders carry the online-payment entry point into the
 * checkout steps.
 */
export default function OrdersSection({ orders }: OrdersSectionProps) {
  const [tab, setTab] = useState<string>('current');

  const current = orders.filter(
    (order) => order.status !== 'delivered' && order.status !== 'cancelled'
  );
  const delivered = orders.filter((order) => order.status === 'delivered');
  const cancelled = orders.filter((order) => order.status === 'cancelled');
  const returns = orders.filter((order) => (order.returnWindow?.requests?.length ?? 0) > 0);

  function panel(list: CustomerOrder[], emptyText = 'سفارشی در این وضعیت نیست.') {
    return list.length === 0 ? (
      <Text size="sm" c="dimmed" py="xl" ta="center">
        {emptyText}
      </Text>
    ) : (
      <Stack gap="sm">
        {list.map((order) => (
          <OrderDetailCard key={order.id} order={order} />
        ))}
      </Stack>
    );
  }

  return (
    <Tabs value={tab} onChange={(value) => setTab(value ?? 'current')}>
      <Tabs.List mb="md">
        <Tabs.Tab value="current">جاری ({faNumber(current.length)})</Tabs.Tab>
        <Tabs.Tab value="delivered">تحویل شده ({faNumber(delivered.length)})</Tabs.Tab>
        <Tabs.Tab value="returns">مرجوعی ({faNumber(returns.length)})</Tabs.Tab>
        <Tabs.Tab value="cancelled">لغو شده ({faNumber(cancelled.length)})</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="current">{panel(current)}</Tabs.Panel>
      <Tabs.Panel value="delivered">{panel(delivered)}</Tabs.Panel>
      <Tabs.Panel value="returns">
        {panel(returns, 'برای هیچ سفارشی درخواست مرجوعی ثبت نشده است.')}
      </Tabs.Panel>
      <Tabs.Panel value="cancelled">{panel(cancelled)}</Tabs.Panel>
    </Tabs>
  );
}
