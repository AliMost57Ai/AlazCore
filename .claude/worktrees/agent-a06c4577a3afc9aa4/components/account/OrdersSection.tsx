'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconCircleCheck, IconCreditCard } from '@tabler/icons-react';
import { Badge, Button, Card, Divider, Group, SimpleGrid, Stack, Tabs, Text } from '@mantine/core';
import { faCurrency, faJalaliLongDate, faNumber } from '@/lib/format';
import {
  CURRENT_EVENT_LABELS,
  DELIVERY_SUB_STATUS_LABELS,
  NEXT_STEP_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type DeliverySubStatus,
} from '@/lib/order-status';
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

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={{ base: 4, sm: 'lg' }}>
          <Stack gap={6}>
            <DetailRow
              label="آخرین رویداد ارسال"
              value={CURRENT_EVENT_LABELS[order.status] ?? '—'}
            />
            <DetailRow label="زیر وضعیت" value={sub ? DELIVERY_SUB_STATUS_LABELS[sub] : '—'} />
            <DetailRow label="تاریخ سفارش" value={order.date} />
            <DetailRow label="کد رهگیری" value={order.trackingCode ?? '—'} />
          </Stack>

          <Stack gap={6}>
            <DetailRow label="مبلغ کل" value={faCurrency(order.amount, false)} />
            <DetailRow
              label="بسته"
              value={`${faNumber(order.packageIndex)} از ${faNumber(order.packageCount)}`}
            />
            <DetailRow label="گام بعدی" value={NEXT_STEP_LABELS[order.status] ?? '—'} />
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

          {order.status === 'pending' ? (
            <Stack gap={6} align="flex-end">
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
            </Stack>
          ) : order.status === 'delivered' ? (
            <IconCircleCheck size={20} style={{ color: 'var(--mantine-color-green-6)' }} />
          ) : null}
        </Group>
      </Stack>
    </Card>
  );
}

/**
 * The customer's order history, grouped into three tabs: «جاری» tracks orders
 * until they're delivered, «تحویل شده» is the delivered archive and «لغو شده»
 * holds orders the shop cancelled. Pending orders carry the online-payment
 * entry point into the checkout steps.
 */
export default function OrdersSection({ orders }: OrdersSectionProps) {
  const [tab, setTab] = useState<string>('current');

  const current = orders.filter(
    (order) => order.status !== 'delivered' && order.status !== 'cancelled'
  );
  const delivered = orders.filter((order) => order.status === 'delivered');
  const cancelled = orders.filter((order) => order.status === 'cancelled');

  function panel(list: CustomerOrder[]) {
    return list.length === 0 ? (
      <Text size="sm" c="dimmed" py="xl" ta="center">
        سفارشی در این وضعیت نیست.
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
        <Tabs.Tab value="cancelled">لغو شده ({faNumber(cancelled.length)})</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="current">{panel(current)}</Tabs.Panel>
      <Tabs.Panel value="delivered">{panel(delivered)}</Tabs.Panel>
      <Tabs.Panel value="cancelled">{panel(cancelled)}</Tabs.Panel>
    </Tabs>
  );
}
