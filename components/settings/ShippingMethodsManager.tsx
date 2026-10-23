'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconMapPin, IconPlus, IconTrash } from '@tabler/icons-react';
import { Badge, Button, Card, Group, Stack, Switch, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { enCurrency, enNumber } from '@/lib/format';
import type { PickupLocationDTO } from '@/lib/pickup';
import type { ShippingMethodDTO } from '@/lib/shipping';

/**
 * The shipping-method manager (روش‌های ارسال): flat list with delete + the
 * pickup toggle. Create/edit live on their own dedicated pages
 * (/settings/shipping/new و /settings/shipping/[id]/edit) — فرم‌های بیش از ۴
 * فیلد مودال باز نمی‌شوند. Each method carries a description, minimum
 * delivery time, minimum shipping cost, and whether the cost lands on the
 * invoice — false means پس‌کرایه, collected at handover instead.
 */
export interface ShippingMethodsManagerProps {
  initial: ShippingMethodDTO[];
  /** نقاط تحویل حضوری (وقتی فیچر در Core فعال باشد؛ وگرنه خالی). */
  pickupLocations?: PickupLocationDTO[];
  /** روش‌های ارسال از نوع تحویل حضوری — مبنای وضعیت فعال هر نقطه. */
  pickupMethods?: ShippingMethodDTO[];
}

export default function ShippingMethodsManager({
  initial,
  pickupLocations = [],
  pickupMethods = [],
}: ShippingMethodsManagerProps) {
  const router = useRouter();
  const [methods, setMethods] = useState<ShippingMethodDTO[]>(initial);
  const [togglingPickup, setTogglingPickup] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch('/api/admin/shipping-methods');
    const payload = (await response.json().catch(() => ({}))) as {
      methods?: ShippingMethodDTO[];
    };
    if (response.ok && payload.methods) {
      setMethods(payload.methods);
    }
  }

  async function remove(method: ShippingMethodDTO) {
    const response = await fetch(
      `/api/admin/shipping-methods?id=${encodeURIComponent(method.id)}`,
      { method: 'DELETE' }
    );
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      notifications.show({
        title: 'خطا',
        message: payload.error ?? 'حذف روش ارسال ناموفق بود.',
        color: 'red',
      });
      return;
    }
    await refresh();
  }

  /** فعال/غیرفعال‌کردن یک نقطه تحویل حضوری به‌عنوان روش ارسال. */
  async function togglePickup(locationId: string, isActive: boolean) {
    setTogglingPickup(locationId);
    try {
      const response = await fetch('/api/admin/shipping-methods/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, isActive }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'تغییر وضعیت تحویل حضوری ناموفق بود.',
          color: 'red',
        });
        return;
      }
      notifications.show({
        message: isActive ? 'تحویل حضوری برای این نقطه فعال شد.' : 'تحویل حضوری این نقطه خاموش شد.',
        color: 'green',
      });
      await refresh();
    } finally {
      setTogglingPickup(null);
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed" maw={520}>
          روش‌های ارسال که مشتری در تسویه‌حساب انتخاب می‌کند. روش «پس‌کرایه» هزینه ارسال را در
          فاکتور نمی‌آورد و مبلغ آن هنگام تحویل از مشتری گرفته می‌شود. سفارش‌های قبلی نام و هزینه
          روش خودشان را نگه می‌دارند، پس حذف بی‌خطر است.
        </Text>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => router.push('/settings/shipping/new')}
        >
          روش ارسال جدید
        </Button>
      </Group>

      <Card withBorder radius="lg" p="sm">
        {methods.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            هنوز روش ارسالی تعریف نشده است.
          </Text>
        ) : (
          <Stack gap={0}>
            {methods.map((method, index) => (
              <Group
                key={method.id}
                justify="space-between"
                py={8}
                wrap="nowrap"
                style={(theme) => ({
                  borderTop: index === 0 ? undefined : `1px solid ${theme.colors.gray[3]}`,
                })}
              >
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={600} lineClamp={1}>
                      {method.name}
                    </Text>
                    <Badge
                      variant="light"
                      color={method.isActive ? 'green' : 'gray'}
                      radius="sm"
                      size="sm"
                    >
                      {method.isActive ? 'فعال' : 'غیرفعال'}
                    </Badge>
                    <Badge
                      variant="light"
                      color={method.isInvoiced ? 'blue' : 'orange'}
                      radius="sm"
                      size="sm"
                    >
                      {method.isInvoiced ? 'در فاکتور' : 'پس‌کرایه'}
                    </Badge>
                  </Group>
                  {method.description ? (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {method.description}
                    </Text>
                  ) : null}
                  <Text size="xs" c="dimmed">
                    حداقل زمان ارسال: {method.minDeliveryDays} روز · حداقل هزینه ارسال:{' '}
                    {enCurrency(method.minShippingCost)}
                  </Text>
                </Stack>
                <Group gap={6} wrap="nowrap">
                  <Button
                    size="compact-xs"
                    variant="light"
                    onClick={() => router.push(`/settings/shipping/${method.id}/edit`)}
                  >
                    ویرایش
                  </Button>
                  <Button
                    size="compact-xs"
                    variant="light"
                    color="red"
                    leftSection={<IconTrash size={12} />}
                    onClick={() => remove(method)}
                  >
                    حذف
                  </Button>
                </Group>
              </Group>
            ))}
          </Stack>
        )}
      </Card>

      {pickupLocations.length > 0 ? (
        <Card withBorder radius="lg" p="sm">
          <Group gap="xs" wrap="nowrap" mb="xs">
            <IconMapPin size={18} stroke={1.8} />
            <Text fw={600}>تحویل حضوری</Text>
          </Group>
          <Text size="xs" c="dimmed" mb="sm">
            الگوها از «مدیریت تحویل حضوری» می‌آیند — برای هر نقطه، فعال‌سازی یعنی روش «تحویل حضوری»
            در تسویه‌حساب مشتری نمایش داده می‌شود (بدون هزینه ارسال).
          </Text>
          <Stack gap={0}>
            {pickupLocations.map((location, index) => {
              const pickupMethod = pickupMethods.find(
                (method) => method.pickupLocationId === location.id
              );
              const isActive = Boolean(pickupMethod?.isActive);
              return (
                <Group
                  key={location.id}
                  justify="space-between"
                  py={8}
                  wrap="nowrap"
                  style={(theme) => ({
                    borderTop: index === 0 ? undefined : `1px solid ${theme.colors.gray[3]}`,
                  })}
                >
                  <Stack gap={2} style={{ minWidth: 0 }}>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={600} lineClamp={1}>
                        {location.title}
                      </Text>
                      <Badge
                        variant="light"
                        color={isActive ? 'green' : 'gray'}
                        radius="sm"
                        size="sm"
                      >
                        {isActive ? 'فعال در تسویه‌حساب' : 'غیرفعال'}
                      </Badge>
                      {!location.isActive ? (
                        <Badge variant="light" color="orange" radius="sm" size="sm">
                          نقطه غیرفعال
                        </Badge>
                      ) : null}
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {location.address} · {enNumber(location.slots.length)} بازه زمانی
                    </Text>
                  </Stack>
                  <Switch
                    checked={isActive}
                    disabled={!location.isActive || togglingPickup === location.id}
                    onChange={(event) =>
                      void togglePickup(location.id, event.currentTarget.checked)
                    }
                    aria-label={`فعال‌سازی تحویل حضوری ${location.title}`}
                  />
                </Group>
              );
            })}
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
