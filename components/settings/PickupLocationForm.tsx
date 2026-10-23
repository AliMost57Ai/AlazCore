'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconCheck, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import type { PickupLocationDTO, PickupSlotDTO } from '@/lib/pickup';

/** 'HH:MM' → دقیقه از نیمه‌شب؛ ورودی خراب = null. */
function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/** دقیقه نیمه‌شب → 'HH:MM' برای TimeInput و بج‌های فهرست. */
export function minutesToTime(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

interface SlotDraft {
  key: number;
  start: string;
  end: string;
  capacity: string;
}

interface LocationFormState {
  id: string | null;
  title: string;
  address: string;
  lat: string;
  lng: string;
  isActive: boolean;
  slots: SlotDraft[];
}

const EMPTY_LOCATION: LocationFormState = {
  id: null,
  title: '',
  address: '',
  lat: '',
  lng: '',
  isActive: true,
  slots: [{ key: 1, start: '09:00', end: '12:00', capacity: '5' }],
};

let slotKeySeed = 100;

export interface PickupLocationFormProps {
  /** Existing location in edit mode — null/undefined = create. */
  initial?: PickupLocationDTO | null;
}

/**
 * فرم ایجاد/ویرایش نقطه تحویل حضوری (با بازه‌های زمانی و ظرفیت) — صفحات
 * اختصاصی /settings/pickup/locations/new و …/[id]/edit (فرم‌های بیش از ۴ فیلد
 * مودال باز نمی‌شوند). همان API قبلی (/api/settings/pickup)؛ پس از ذخیره به
 * تنظیمات تحویل حضوری برمی‌گردد.
 */
export default function PickupLocationForm({ initial }: PickupLocationFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<LocationFormState>(() =>
    initial
      ? {
          id: initial.id,
          title: initial.title,
          address: initial.address,
          lat: initial.lat !== null ? String(initial.lat) : '',
          lng: initial.lng !== null ? String(initial.lng) : '',
          isActive: initial.isActive,
          slots: initial.slots.map((slot: PickupSlotDTO) => {
            slotKeySeed += 1;
            return {
              key: slotKeySeed,
              start: minutesToTime(slot.startMinute),
              end: minutesToTime(slot.endMinute),
              capacity: String(slot.capacity),
            };
          }),
        }
      : { ...EMPTY_LOCATION, slots: [{ ...EMPTY_LOCATION.slots[0] }] }
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function updateSlot(key: number, patch: Partial<SlotDraft>) {
    setForm((current) =>
      current
        ? {
            ...current,
            slots: current.slots.map((slot) => (slot.key === key ? { ...slot, ...patch } : slot)),
          }
        : current
    );
  }

  async function save() {
    setFormError(null);

    const slots = [];
    for (const slot of form.slots) {
      const start = timeToMinutes(slot.start);
      const end = timeToMinutes(slot.end);
      const capacity = Number(slot.capacity);
      if (start === null || end === null) {
        setFormError('ساعت بازه‌ها را به شکل HH:MM وارد کنید.');
        return;
      }
      if (!Number.isInteger(capacity) || capacity < 1) {
        setFormError('ظرفیت هر بازه باید عددی حداقل ۱ باشد.');
        return;
      }
      slots.push({ startMinute: start, endMinute: end, capacity });
    }

    setSaving(true);
    try {
      const response = await fetch('/api/settings/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          title: form.title,
          address: form.address,
          lat: form.lat.trim() === '' ? null : Number(form.lat),
          lng: form.lng.trim() === '' ? null : Number(form.lng),
          isActive: form.isActive,
          slots,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setFormError(payload.error ?? 'ذخیره نقطه تحویل ناموفق بود.');
        return;
      }
      notifications.show({ message: 'نقطه تحویل ذخیره شد.', color: 'green' });
      router.push('/settings/pickup');
    } catch {
      setFormError('ارتباط با سرور برقرار نشد.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="sm">
      <TextInput
        label="عنوان نقطه"
        placeholder="مثلاً شعبه مرکزی"
        required
        value={form.title}
        onChange={(event) => setForm({ ...form, title: event.currentTarget.value })}
      />
      <TextInput
        label="نشانی کامل"
        placeholder="شهر، خیابان، پلاک"
        required
        value={form.address}
        onChange={(event) => setForm({ ...form, address: event.currentTarget.value })}
      />
      <Group gap="sm" align="flex-end" wrap="nowrap">
        <TextInput
          label="عرض جغرافیایی (lat)"
          placeholder="35.74484"
          value={form.lat}
          onChange={(event) => setForm({ ...form, lat: event.currentTarget.value })}
          style={{ flex: 1 }}
          dir="ltr"
        />
        <TextInput
          label="طول جغرافیایی (lng)"
          placeholder="51.37532"
          value={form.lng}
          onChange={(event) => setForm({ ...form, lng: event.currentTarget.value })}
          style={{ flex: 1 }}
          dir="ltr"
        />
      </Group>
      <Switch
        label="نقطه فعال"
        description="نقاط غیرفعال در چک‌اوت مشتری نمایش داده نمی‌شوند"
        checked={form.isActive}
        onChange={(event) => setForm({ ...form, isActive: event.currentTarget.checked })}
      />

      <Stack gap="xs">
        <Text size="sm" fw={600}>
          بازه‌های زمانی تحویل
        </Text>
        {form.slots.map((slot) => (
          <Group key={slot.key} gap="xs" wrap="nowrap" align="flex-end">
            <TimeInput
              label="از"
              value={slot.start}
              onChange={(event) => updateSlot(slot.key, { start: event.currentTarget.value })}
              style={{ width: 110 }}
            />
            <TimeInput
              label="تا"
              value={slot.end}
              onChange={(event) => updateSlot(slot.key, { end: event.currentTarget.value })}
              style={{ width: 110 }}
            />
            <NumberInput
              label="ظرفیت/روز"
              min={1}
              max={999}
              value={slot.capacity === '' ? '' : Number(slot.capacity)}
              onChange={(value) => updateSlot(slot.key, { capacity: String(value ?? '') })}
              style={{ width: 120 }}
            />
            <ActionIcon
              variant="default"
              color="red"
              mb={6}
              aria-label="حذف بازه"
              onClick={() =>
                setForm({
                  ...form,
                  slots: form.slots.filter((one) => one.key !== slot.key),
                })
              }
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        ))}
        <Button
          variant="light"
          size="compact-sm"
          leftSection={<IconPlus size={14} />}
          onClick={() => {
            slotKeySeed += 1;
            setForm({
              ...form,
              slots: [...form.slots, { key: slotKeySeed, start: '', end: '', capacity: '5' }],
            });
          }}
          style={{ alignSelf: 'flex-start' }}
        >
          افزودن بازه
        </Button>
      </Stack>

      {formError ? (
        <Text size="sm" c="red">
          {formError}
        </Text>
      ) : null}

      <Group justify="flex-end" mt="xs">
        <Button variant="subtle" component={Link} href="/settings/pickup">
          انصراف
        </Button>
        <Button leftSection={<IconCheck size={16} />} loading={saving} onClick={save}>
          ذخیره
        </Button>
      </Group>
    </Stack>
  );
}
