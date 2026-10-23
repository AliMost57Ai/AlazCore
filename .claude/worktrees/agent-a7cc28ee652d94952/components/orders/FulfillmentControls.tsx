'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconBan,
  IconCircleCheck,
  IconMessage2,
  IconPackage,
  IconTruck,
  IconUserCheck,
} from '@tabler/icons-react';
import { Button, Group, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { faJalaliLongDate } from '@/lib/format';
import type { Order } from '@/lib/orders';

export interface FulfillmentControlsProps {
  order: Pick<Order, 'id' | 'status' | 'trackingCode' | 'notified'>;
}

/** Delivery-date choices offered when posting: today through +10 days. */
const ARRIVAL_CHOICES = 10;
/** Tipax promises at least 3 days — the preselected choice. */
const ARRIVAL_DEFAULT_OFFSET = 3;

function toIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Admin fulfillment actions for one order row, per its state:
 * paid → boxing → posted (tracking code + promised delivery date) → notice
 * SMS → delivered. Any non-terminal order can also be cancelled.
 */
export default function FulfillmentControls({ order }: FulfillmentControlsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingBoxing, setConfirmingBoxing] = useState(false);
  const [tracking, setTracking] = useState(order.trackingCode ?? '');
  const [postingOpen, setPostingOpen] = useState(false);
  const [arrival, setArrival] = useState<string | null>(() => {
    const date = new Date();
    date.setDate(date.getDate() + ARRIVAL_DEFAULT_OFFSET);
    return toIsoDate(date);
  });

  // Persian-labeled delivery dates, generated on the client so server and
  // browser never disagree about "today" (hydration-safe by construction).
  const arrivalOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (let offset = 0; offset < ARRIVAL_CHOICES; offset += 1) {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      options.push({ value: toIsoDate(date), label: faJalaliLongDate(date) });
    }
    return options;
  }, []);

  async function post(body: Record<string, unknown>, busy: string, success: string) {
    setLoading(busy);
    try {
      const response = await fetch(`/api/orders/${order.id}/fulfillment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'عملیات ناموفق بود.',
          color: 'red',
        });
        return;
      }

      notifications.show({ message: success, color: 'green' });
      router.refresh();
    } catch {
      notifications.show({
        title: 'خطا',
        message: 'ارتباط با سرور برقرار نشد.',
        color: 'red',
      });
    } finally {
      setLoading('');
    }
  }

  /** The admin's way out: mark the order cancelled (irreversible). */
  const cancelButton = (
    <Button
      size="xs"
      variant="light"
      color="red"
      leftSection={<IconBan size={14} />}
      onClick={() => setConfirmingCancel(true)}
    >
      لغو سفارش
    </Button>
  );

  let controls: React.ReactNode;

  if (order.status === 'paid') {
    controls = (
      <Group gap="xs" wrap="nowrap">
        <Button
          size="xs"
          variant="light"
          color="violet"
          leftSection={<IconPackage size={14} />}
          onClick={() => setConfirmingBoxing(true)}
        >
          بسته‌بندی
        </Button>
        {cancelButton}
      </Group>
    );
  } else if (order.status === 'boxing') {
    // Collapsed by default: a compact expander keeps the orders table narrow;
    // the inline form (tracking code + arrival date) opens on demand and
    // «انصراف» closes it again without touching the order.
    controls = postingOpen ? (
      <Stack gap="xs" w={{ base: '100%', sm: 260 }}>
        <Group gap="xs" wrap="nowrap">
          <TextInput
            size="xs"
            w={150}
            dir="ltr"
            placeholder="کد رهگیری"
            value={tracking}
            onChange={(event) => setTracking(event.currentTarget.value)}
            aria-label={`کد رهگیری سفارش ${order.id}`}
          />
          <Button
            size="xs"
            variant="filled"
            leftSection={<IconTruck size={14} />}
            loading={loading === 'posted'}
            onClick={() =>
              post(
                { action: 'posted', trackingCode: tracking, estimatedArrival: arrival },
                'posted',
                'سفارش ارسال شد؛ حالا می‌توانید به مشتری اطلاع‌رسانی کنید.'
              )
            }
          >
            ثبت ارسال
          </Button>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={() => {
              setPostingOpen(false);
              setTracking(order.trackingCode ?? '');
            }}
          >
            انصراف
          </Button>
        </Group>
        <Select
          size="xs"
          label="تاریخ تخمینی تحویل"
          data={arrivalOptions}
          value={arrival}
          onChange={setArrival}
          allowDeselect={false}
          aria-label={`تاریخ تخمینی تحویل سفارش ${order.id}`}
        />
        {cancelButton}
      </Stack>
    ) : (
      <Group gap="xs" wrap="nowrap">
        <Button
          size="xs"
          variant="light"
          color="brand"
          leftSection={<IconTruck size={14} />}
          onClick={() => setPostingOpen(true)}
        >
          ثبت ارسال
        </Button>
        {cancelButton}
      </Group>
    );
  } else if (order.status === 'posted') {
    controls = (
      <Group gap="xs" wrap="nowrap">
        <Button
          size="xs"
          variant="light"
          color={order.notified ? 'green' : 'brand'}
          leftSection={order.notified ? <IconCircleCheck size={14} /> : <IconMessage2 size={14} />}
          disabled={order.notified}
          loading={loading === 'notice'}
          onClick={() =>
            post({ action: 'notice' }, 'notice', 'پیامک اطلاع‌رسانی ارسال برای مشتری ارسال شد.')
          }
        >
          {order.notified ? 'اطلاع‌رسانی شد' : 'اطلاع‌رسانی پیامک'}
        </Button>
        <Button
          size="xs"
          variant="light"
          color="teal"
          leftSection={<IconUserCheck size={14} />}
          loading={loading === 'delivered'}
          onClick={() => post({ action: 'delivered' }, 'delivered', 'سفارش تحویل مشتری داده شد.')}
        >
          تحویل شد
        </Button>
        {cancelButton}
      </Group>
    );
  } else if (order.status === 'delivered') {
    controls = (
      <Group gap={6} wrap="nowrap" c="teal">
        <IconCircleCheck size={16} />
        <Text size="xs" fw={500}>
          تحویل داده شد
        </Text>
      </Group>
    );
  } else if (order.status === 'cancelled') {
    controls = (
      <Group gap={6} wrap="nowrap" c="red">
        <IconBan size={16} />
        <Text size="xs" fw={500}>
          لغو شده
        </Text>
      </Group>
    );
  } else {
    // pending: nothing to fulfill yet, but the admin can still cancel it.
    controls = cancelButton;
  }

  return (
    <>
      {controls}

      <Modal
        opened={confirmingBoxing}
        onClose={() => setConfirmingBoxing(false)}
        title="شروع بسته‌بندی"
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            سفارش {order.id} به حالت بسته‌بندی برود؟ وضعیت آن برای مشتری به «در حال بسته‌بندی» تغییر
            می‌کند.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setConfirmingBoxing(false)}>
              انصراف
            </Button>
            <Button
              color="violet"
              loading={loading === 'boxing'}
              onClick={() => {
                setConfirmingBoxing(false);
                post({ action: 'boxing' }, 'boxing', 'سفارش به حالت بسته‌بندی رفت.');
              }}
            >
              ثبت
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={confirmingCancel}
        onClose={() => setConfirmingCancel(false)}
        title="لغو سفارش"
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            سفارش {order.id} لغو شود؟ این عمل قابل بازگشت نیست و مشتری آن را در تب «لغو شده»
            می‌بیند.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setConfirmingCancel(false)}>
              انصراف
            </Button>
            <Button
              color="red"
              loading={loading === 'cancelled'}
              onClick={() => {
                setConfirmingCancel(false);
                post({ action: 'cancelled' }, 'cancelled', 'سفارش لغو شد.');
              }}
            >
              لغو سفارش
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
