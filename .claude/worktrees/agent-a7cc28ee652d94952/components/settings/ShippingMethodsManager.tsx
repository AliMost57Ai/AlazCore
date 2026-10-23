'use client';

import { useState } from 'react';
import { IconAlertCircle, IconCircleCheck, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { faCurrency } from '@/lib/format';
import type { ShippingMethodDTO } from '@/lib/shipping';

interface FormState {
  id: string | null;
  name: string;
  description: string;
  minDeliveryDays: number;
  minShippingCost: number;
  isInvoiced: boolean;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  description: '',
  minDeliveryDays: 1,
  minShippingCost: 0,
  isInvoiced: true,
  isActive: true,
};

/**
 * The shipping-method manager (روش‌های ارسال): flat list with add / edit /
 * delete. Each method carries a description, minimum delivery time, minimum
 * shipping cost, and whether the cost lands on the invoice — false means
 * پس‌کرایه, collected at handover instead.
 */
export default function ShippingMethodsManager({ initial }: { initial: ShippingMethodDTO[] }) {
  const [methods, setMethods] = useState<ShippingMethodDTO[]>(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const response = await fetch('/api/admin/shipping-methods');
    const payload = (await response.json().catch(() => ({}))) as {
      methods?: ShippingMethodDTO[];
    };
    if (response.ok && payload.methods) {
      setMethods(payload.methods);
    }
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(method: ShippingMethodDTO) {
    setForm({
      id: method.id,
      name: method.name,
      description: method.description,
      minDeliveryDays: method.minDeliveryDays,
      minShippingCost: method.minShippingCost,
      isInvoiced: method.isInvoiced,
      isActive: method.isActive,
    });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/shipping-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id ?? undefined,
          name: form.name,
          description: form.description,
          minDeliveryDays: form.minDeliveryDays,
          minShippingCost: form.minShippingCost,
          isInvoiced: form.isInvoiced,
          isActive: form.isActive,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'ذخیره روش ارسال ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }
      setOpen(false);
      await refresh();
      notifications.show({
        title: 'ذخیره شد',
        message: 'روش ارسال ذخیره شد.',
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
    } catch (error) {
      notifications.show({
        title: 'خطا',
        message: error instanceof Error ? error.message : 'ارتباط با سرور برقرار نشد.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setSaving(false);
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
        icon: <IconAlertCircle size={18} />,
      });
      return;
    }
    await refresh();
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed" maw={520}>
          روش‌های ارسال که مشتری در تسویه‌حساب انتخاب می‌کند. روش «پس‌کرایه» هزینه ارسال را در
          فاکتور نمی‌آورد و مبلغ آن هنگام تحویل از مشتری گرفته می‌شود. سفارش‌های قبلی نام و هزینه
          روش خودشان را نگه می‌دارند، پس حذف بی‌خطر است.
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
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
                    {faCurrency(method.minShippingCost)}
                  </Text>
                </Stack>
                <Group gap={6} wrap="nowrap">
                  <Button size="compact-xs" variant="light" onClick={() => openEdit(method)}>
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

      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title={form.id ? 'ویرایش روش ارسال' : 'افزودن روش ارسال'}
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="نام"
            placeholder="مثلاً تیپاکس"
            maxLength={60}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <Textarea
            label="توضیح"
            description="زیر نام روش در تسویه‌حساب نمایش داده می‌شود."
            placeholder="مثلاً ارسال به سراسر کشور، تحویل درب منزل"
            maxLength={300}
            autosize
            minRows={2}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
          />
          <NumberInput
            label="حداقل زمان ارسال (روز)"
            description="زمان تقریبی آماده‌سازی و ارسال سفارش."
            min={0}
            max={90}
            step={1}
            value={form.minDeliveryDays}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                minDeliveryDays: typeof value === 'number' ? value : Number(value) || 0,
              }))
            }
          />
          <NumberInput
            label="حداقل هزینه ارسال (تومان)"
            description="مبلغ پایه‌ای که به فاکتور اضافه می‌شود."
            min={0}
            max={1_000_000_000}
            step={1000}
            thousandSeparator=","
            value={form.minShippingCost}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                minShippingCost: typeof value === 'number' ? value : Number(value) || 0,
              }))
            }
          />
          <Switch
            label="هزینه ارسال در فاکتور محاسبه شود"
            description="خاموش کنید تا روش «پس‌کرایه» باشد — هزینه هنگام تحویل از مشتری گرفته می‌شود و در فاکتور نمی‌آید."
            checked={form.isInvoiced}
            onChange={(event) =>
              setForm((current) => ({ ...current, isInvoiced: event.currentTarget.checked }))
            }
          />
          <Switch
            label="فعال باشد"
            description="روش غیرفعال در تسویه‌حساب به مشتری نمایش داده نمی‌شود."
            checked={form.isActive}
            onChange={(event) =>
              setForm((current) => ({ ...current, isActive: event.currentTarget.checked }))
            }
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button loading={saving} onClick={save}>
              ذخیره
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
