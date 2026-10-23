import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Badge, Card, Group, Stack, Text } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import PanelBackButton from '@/components/ui/panel/PanelBackButton';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { isInPersonDeliveryEnabled } from '@/lib/core-license';
import { STATUS_COLORS, STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import { pickupOrdersList } from '@/lib/pickup';
import ReschedulePageForm from './ReschedulePageForm';

export const metadata: Metadata = {
  title: 'تغییر برنامه تحویل',
};

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

function isOrderStatus(status: string): status is OrderStatus {
  return ['paid', 'pending', 'boxing', 'posted', 'shipped', 'delivered', 'cancelled'].includes(
    status
  );
}

/**
 * صفحه اختصاصی «تغییر برنامه تحویل» — قاعده پنل: فرم‌های ردیف در موبایل مودال
 * باز نمی‌کنند، صفحه باز می‌کنند. دسکتاپ همان کار را با مودال انجام می‌دهد؛
 * فرم هر دو از PickupRescheduleForm مشترک است.
 */
export default async function PickupReschedulePage({ params }: PageProps) {
  const session = await requireSession('/orders/pickup');
  if (!canAccessMenu(session, '/orders/pickup', 'edit')) {
    redirect('/dashboard');
  }
  if (!(await isInPersonDeliveryEnabled())) {
    redirect('/dashboard');
  }

  const { id } = await params;
  const displayId = decodeURIComponent(id);
  const orders = await pickupOrdersList('all', displayId);
  const order = orders.find((row) => row.displayId === displayId) ?? null;
  if (!order) {
    notFound();
  }

  const status = isOrderStatus(order.status) ? order.status : null;

  return (
    <Stack gap="lg">
      <Group gap="xs" className="no-print">
        <PanelBackButton />
      </Group>

      <PageHeader
        title={`تغییر برنامه تحویل — ${order.displayId}`}
        description={`${order.customer} — رزرو فعلی: ${order.pickupDateLabel}، ${order.slotLabel}`}
      />

      <Card padding="lg" withBorder>
        <Stack gap="sm">
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              نقطه تحویل
            </Text>
            <Text size="sm" ta="end">
              {order.locationTitle} — {order.locationAddress}
            </Text>
          </Group>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              وضعیت سفارش
            </Text>
            {status ? (
              <Badge variant="light" color={STATUS_COLORS[status]}>
                {STATUS_LABELS[status]}
              </Badge>
            ) : (
              <Text size="sm">{order.status}</Text>
            )}
          </Group>
        </Stack>
      </Card>

      <Card padding="lg" withBorder>
        <ReschedulePageForm order={order} />
      </Card>
    </Stack>
  );
}
