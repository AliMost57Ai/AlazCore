import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Card, Group, Stack, Text } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import PanelBackButton from '@/components/ui/panel/PanelBackButton';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { isInPersonDeliveryEnabled } from '@/lib/core-license';
import { pickupOrdersList } from '@/lib/pickup';
import CancelPageForm from './CancelPageForm';

export const metadata: Metadata = {
  title: 'لغو سفارش تحویل حضوری',
};

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

/**
 * صفحه اختصاصی «لغو سفارش تحویل حضوری» — تأیید لغو در موبایل مودال باز
 * نمی‌کند؛ همین صفحه با توضیح برگشت وجه و دکمه تأیید قرمز است.
 */
export default async function PickupCancelPage({ params }: PageProps) {
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

  const paid = order.status !== 'pending';

  return (
    <Stack gap="lg">
      <Group gap="xs" className="no-print">
        <PanelBackButton />
      </Group>

      <PageHeader
        title={`لغو سفارش ${order.displayId}`}
        description={`${order.customer} — رزرو: ${order.locationTitle}، ${order.pickupDateLabel}، ${order.slotLabel}`}
      />

      <Card padding="lg" withBorder>
        <CancelPageForm
          orderId={order.id}
          displayId={order.displayId}
          amount={order.amount}
          paid={paid}
        />
      </Card>

      <Text size="xs" c="dimmed">
        لغو سفارش، رزرو نقطه و بازه تحویل را آزاد می‌کند و در وضعیت‌های بعد از پرداخت، مبلغ به کیف
        پول مشتری برگشت داده می‌شود.
      </Text>
    </Stack>
  );
}
