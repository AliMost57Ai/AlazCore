'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import { Button, Group, NumberInput, Stack, Switch, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ShippingMethodDTO } from '@/lib/shipping';

interface FormState {
  name: string;
  description: string;
  minDeliveryDays: number;
  minShippingCost: number;
  isInvoiced: boolean;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  minDeliveryDays: 1,
  minShippingCost: 0,
  isInvoiced: true,
  isActive: true,
};

export interface ShippingMethodFormProps {
  /** Existing method in edit mode — null/undefined = create. */
  initial?: ShippingMethodDTO | null;
}

/**
 * فرم ایجاد/ویرایش روش ارسال — صفحات اختصاصی /settings/shipping/new و
 * …/[id]/edit (فرم‌های بیش از ۴ فیلد مودال باز نمی‌شوند). همان API قبلی
 * (/api/admin/shipping-methods)؛ پس از ذخیره به فهرست روش‌ها برمی‌گردد.
 */
export default function ShippingMethodForm({ initial }: ShippingMethodFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          name: initial.name,
          description: initial.description,
          minDeliveryDays: initial.minDeliveryDays,
          minShippingCost: initial.minShippingCost,
          isInvoiced: initial.isInvoiced,
          isActive: initial.isActive,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/shipping-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: initial?.id,
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
      notifications.show({
        title: 'ذخیره شد',
        message: 'روش ارسال ذخیره شد.',
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
      router.push('/settings/shipping');
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

  return (
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
        <Button variant="default" component={Link} href="/settings/shipping">
          انصراف
        </Button>
        <Button loading={saving} onClick={save}>
          ذخیره
        </Button>
      </Group>
    </Stack>
  );
}
