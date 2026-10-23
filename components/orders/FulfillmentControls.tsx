'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconBan,
  IconCircleCheck,
  IconDotsVertical,
  IconMessage2,
  IconPackage,
  IconTruck,
  IconUserCheck,
} from '@tabler/icons-react';
import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Modal,
  Popover,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { faJalaliLongDate } from '@/lib/format';
import type { Order } from '@/lib/orders';

export interface FulfillmentControlsProps {
  order: Pick<
    Order,
    'id' | 'status' | 'trackingCode' | 'notified' | 'oversell' | 'oversellBlocked'
  >;
}

/** Delivery-date choices offered when posting: today through +10 days. */
const ARRIVAL_CHOICES = 10;
/** Tipax promises at least 3 days — the preselected choice. */
const ARRIVAL_DEFAULT_OFFSET = 3;
/** پیام پیش‌فرض لغو سفارش خالی‌فروشی — همان «عدم موجودی» قرارداد محصول. */
const OVERSELL_CANCEL_NOTE = 'عدم موجودی کالا';

function toIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * عملیات fulfilment هر سفارش — چیدمان استاندارد ستون عملیات:
 *  - فقط «مرحله بعد» دکمه مرئی است (paid → بسته‌بندی، boxing → ثبت ارسال،
 *    posted → اطلاع‌رسانی پیامک)؛
 *  - بقیه عملیات در منوی سه‌نقطه عمودی با آیکون است (تحویل شد، لغو سفارش)؛
 *  - فرم ثبت ارسال (کد رهگیری + تاریخ تخمینی تحویل) در Popover لنگرشده به
 *    دکمه باز می‌شود — نه داخل ردیف جدول (استاندارد UX فرم‌های درون‌ردیفی).
 * حالت‌های پایانی (delivered/cancelled) فقط برچسب وضعیت‌اند.
 */
export default function FulfillmentControls({ order }: FulfillmentControlsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingBoxing, setConfirmingBoxing] = useState(false);
  const [cancelNote, setCancelNote] = useState(order.oversell ? OVERSELL_CANCEL_NOTE : '');
  const [tracking, setTracking] = useState(order.trackingCode ?? '');
  const [postingOpen, setPostingOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
      setPostingOpen(false);
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

  const terminal =
    order.status === 'delivered' || order.status === 'cancelled' ? order.status : null;

  /** مرحله بعدِ خط تولید — تنها دکمه مرئی ستون عملیات. سفارش خالی‌فروشیِ
   * دارای کسری باز تا افزایش موجودی قفل است: به‌جای دکمه فقط راهنمای اقدام. */
  let nextStep: React.ReactNode = null;
  if (order.oversellBlocked && (order.status === 'paid' || order.status === 'boxing')) {
    nextStep = (
      <Group gap={6} wrap="nowrap">
        <ThemeIcon size="xs" variant="light" color="orange" radius="sm">
          <IconPackage size={12} />
        </ThemeIcon>
        <Text size="xs" c="orange.7" style={{ whiteSpace: 'nowrap' }}>
          ابتدا موجودی را افزایش دهید
        </Text>
      </Group>
    );
  } else if (order.status === 'paid') {
    nextStep = (
      <Button
        size="xs"
        variant="light"
        color="violet"
        leftSection={<IconPackage size={14} />}
        onClick={() => setConfirmingBoxing(true)}
      >
        بسته‌بندی
      </Button>
    );
  } else if (order.status === 'boxing') {
    nextStep = (
      <Popover
        opened={postingOpen}
        onChange={setPostingOpen}
        position="bottom-start"
        withArrow
        withinPortal
        shadow="md"
      >
        <Popover.Target>
          <Button
            size="xs"
            variant="light"
            color="brand"
            leftSection={<IconTruck size={14} />}
            onClick={() => setPostingOpen((open) => !open)}
          >
            ثبت ارسال
          </Button>
        </Popover.Target>
        <Popover.Dropdown w={280}>
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              ثبت ارسال سفارش
            </Text>
            <TextInput
              size="xs"
              dir="ltr"
              placeholder="کد رهگیری"
              value={tracking}
              onChange={(event) => setTracking(event.currentTarget.value)}
              aria-label={`کد رهگیری سفارش ${order.id}`}
            />
            {/* دراپ‌داون Select باید داخل همین Popover رندر شود — با withinPortal
                پیش‌فرض، mousedown روی گزینه‌ها «کلیک بیرون» حساب شده و کل باکسِ
                ثبت ارسال بسته می‌شد (مقادیر واردشده هم باید بماند). */}
            <Select
              size="xs"
              label="تاریخ تخمینی تحویل"
              data={arrivalOptions}
              value={arrival}
              onChange={setArrival}
              allowDeselect={false}
              comboboxProps={{ withinPortal: false }}
              aria-label={`تاریخ تخمینی تحویل سفارش ${order.id}`}
            />
            <Group justify="flex-end" gap="xs" mt={4}>
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
            </Group>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    );
  } else if (order.status === 'posted') {
    nextStep = (
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
        {order.notified ? 'اطلاع‌رسانی شد' : 'اطلاع‌رسانی'}
      </Button>
    );
  }

  /** عملیات ثانویه — منوی سه‌نقطه عمودی با آیکون. */
  const menuItems: React.ReactNode[] = [];
  if (order.status === 'posted') {
    menuItems.push(
      <Menu.Item
        key="delivered"
        leftSection={<IconUserCheck size={14} />}
        disabled={loading === 'delivered'}
        onClick={() => post({ action: 'delivered' }, 'delivered', 'سفارش تحویل مشتری داده شد.')}
      >
        تحویل شد
      </Menu.Item>
    );
  }
  if (!terminal) {
    menuItems.push(
      <Menu.Item
        key="cancel"
        color="red"
        leftSection={<IconBan size={14} />}
        onClick={() => setConfirmingCancel(true)}
      >
        لغو سفارش
      </Menu.Item>
    );
  }

  if (terminal) {
    return (
      <Group gap={6} wrap="nowrap" c={terminal === 'delivered' ? 'teal' : 'red'}>
        {terminal === 'delivered' ? <IconCircleCheck size={16} /> : <IconBan size={16} />}
        <Text size="xs" fw={500}>
          {terminal === 'delivered' ? 'تحویل داده شد' : 'لغو شده'}
        </Text>
      </Group>
    );
  }

  return (
    <>
      <Group gap="xs" wrap="nowrap">
        {nextStep}
        {menuItems.length > 0 ? (
          <Menu
            opened={menuOpen}
            onChange={setMenuOpen}
            position="bottom-start"
            withinPortal
            shadow="md"
          >
            <Menu.Target>
              <ActionIcon variant="default" size="xs" aria-label={`عملیات بیشتر سفارش ${order.id}`}>
                <IconDotsVertical size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>{menuItems}</Menu.Dropdown>
          </Menu>
        ) : null}
      </Group>

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
          {/* پیام فروشگاه روی سفارش می‌نشیند و مشتری در کارت سفارشش می‌بیند —
              برای سفارش خالی‌فروشی پیش‌فرض «عدم موجودی کالا» است. */}
          <Textarea
            label="پیام به مشتری"
            description="روی کارت سفارش مشتری نمایش داده می‌شود."
            placeholder={order.oversell ? OVERSELL_CANCEL_NOTE : 'مثلاً: از طرف مشتری لغو شد'}
            value={cancelNote}
            onChange={(event) => setCancelNote(event.currentTarget.value)}
            minRows={2}
            maxRows={4}
            maxLength={300}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setConfirmingCancel(false)}>
              انصراف
            </Button>
            <Button
              color="red"
              loading={loading === 'cancelled'}
              onClick={() => {
                const note = cancelNote.trim() || (order.oversell ? OVERSELL_CANCEL_NOTE : '');
                setConfirmingCancel(false);
                setCancelNote('');
                post({ action: 'cancelled', note }, 'cancelled', 'سفارش لغو شد.');
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
