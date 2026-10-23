'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconBan } from '@tabler/icons-react';
import { Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { cancelPickupOrder } from '@/components/orders/pickup-api';
import { enCurrency } from '@/lib/format';

/**
 * تأیید لغو در صفحه اختصاصی — توضیح برگشت وجه + دکمه قرمز؛ پس از لغو به لیست
 * تحویل حضوری برمی‌گردد.
 */
export default function CancelPageForm({
  orderId,
  displayId,
  amount,
  paid,
}: {
  orderId: string;
  displayId: string;
  amount: number;
  paid: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function confirmCancel() {
    setBusy(true);
    const result = await cancelPickupOrder(orderId);
    setBusy(false);
    if (!result.ok) {
      notifications.show({ title: 'خطا', message: result.error, color: 'red' });
      return;
    }
    notifications.show({
      message:
        result.refunded > 0
          ? `سفارش ${displayId} لغو شد و ${enCurrency(result.refunded, false)} به کیف پول مشتری برگشت.`
          : `سفارش ${displayId} لغو شد.`,
      color: 'green',
    });
    router.push('/orders/pickup');
    router.refresh();
  }

  return (
    <Stack gap="sm">
      <Text size="sm">
        سفارش {displayId} لغو شود؟ رزرو تحویل حضوری آن آزاد می‌شود
        {paid ? ' و مبلغ پرداخت‌شده به کیف پول مشتری برگشت داده می‌شود' : ''}.
      </Text>
      {paid ? (
        <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
          مبلغ قابل برگشت: {enCurrency(amount, false)} تومان
        </Text>
      ) : null}
      <Group justify="flex-end">
        <Button variant="subtle" onClick={() => router.back()}>
          انصراف
        </Button>
        <Button
          color="red"
          leftSection={<IconBan size={16} />}
          loading={busy}
          onClick={confirmCancel}
        >
          لغو سفارش
        </Button>
      </Group>
    </Stack>
  );
}
