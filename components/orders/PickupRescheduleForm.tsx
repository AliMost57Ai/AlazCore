'use client';

import { useEffect, useState } from 'react';
import { Button, Group, Select, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { fetchPickupAvailability, reschedulePickupOrder } from '@/components/orders/pickup-api';
import { PersianDateTimePicker } from '@/components/PersianDateTimePicker/PersianDateTimePicker';
import { enNumber } from '@/lib/format';
import type { PickupDayAvailability, PickupOrderDTO } from '@/lib/pickup';

export interface PickupRescheduleFormProps {
  order: PickupOrderDTO;
  /** پس از ثبت موفق — نوتیفیکیشن و ناوبری/رفرش با caller. */
  onDone: (info: { dateLabel: string; slotLabel: string }) => void;
  /** فقط در مودال: دکمه انصراف. صفحه اختصاصی انصراف ندارد. */
  onCancel?: () => void;
}

/**
 * فرم واحد «تغییر تاریخ و بازه تحویل» — هم مودال دسکتاپ و هم صفحه اختصاصی
 * موبایل از همین کامپوننت رندر می‌کنند تا رفتار دو مسیر یکسان بماند.
 * فیلدها هم‌مقیاس md: تقویم شمسی + بازه‌های با ظرفیت + علتِ اجباری.
 */
export default function PickupRescheduleForm({
  order,
  onDone,
  onCancel,
}: PickupRescheduleFormProps) {
  const [date, setDate] = useState(order.pickupDate);
  const [slotId, setSlotId] = useState<string | null>(order.pickupSlotId);
  const [note, setNote] = useState('');
  const [availability, setAvailability] = useState<PickupDayAvailability[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const days = await fetchPickupAvailability(order.locationId);
      if (!cancelled) {
        setAvailability(days);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [order.locationId]);

  const selectedDay = availability?.find((day) => day.date === date) ?? null;

  async function save() {
    if (!date || !slotId) {
      setError('روز و بازه زمانی جدید را انتخاب کنید.');
      return;
    }
    if (note.trim().length < 3) {
      setError('علت تغییر را بنویسید (حداقل ۳ نویسه).');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await reschedulePickupOrder(order.id, {
      date,
      slotId,
      note: note.trim(),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    notifications.show({
      message: `برنامه تحویل سفارش ${order.displayId} به ${result.dateLabel}، ${result.slotLabel} تغییر کرد.`,
      color: 'green',
    });
    onDone({ dateLabel: result.dateLabel, slotLabel: result.slotLabel });
  }

  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">
        برنامه فعلی: {order.pickupDateLabel}، {order.slotLabel} — نقطه: {order.locationTitle}
      </Text>

      <PersianDateTimePicker
        label="روز جدید تحویل"
        placeholder="انتخاب روز"
        size="compact"
        value={date ? `${date}T00:00:00` : null}
        valueFormat="YYYY-MM-DD"
        dateFormat="numeric"
        showTime={false}
        clearable={false}
        onChange={(value) => {
          const next = typeof value === 'string' ? value : '';
          setDate(next);
          setSlotId(null);
        }}
      />

      <Select
        label="بازه زمانی جدید"
        placeholder={
          availability === null
            ? 'در حال دریافت ظرفیت‌ها…'
            : selectedDay && selectedDay.slots.length > 0
              ? 'انتخاب بازه'
              : 'بازه‌ای برای این روز نیست'
        }
        data={
          selectedDay?.slots.map((slot) => ({
            value: slot.id,
            label: `${slot.label} — ${slot.isPast ? 'گذشته' : slot.remaining > 0 ? `${enNumber(slot.remaining)} ظرفیت آزاد` : 'ظرفیت پر'}`,
            disabled: slot.isPast || slot.remaining <= 0,
          })) ?? []
        }
        value={slotId}
        onChange={setSlotId}
        disabled={availability === null || !selectedDay}
        allowDeselect={false}
      />

      <Textarea
        label="علت تغییر"
        description="برای مشتری در صفحه سفارش‌های من نمایش داده می‌شود."
        placeholder="مثلاً به دلیل تعطیلی انبار شعبه…"
        required
        minRows={2}
        autosize
        maxLength={300}
        value={note}
        onChange={(event) => setNote(event.currentTarget.value)}
      />

      {error ? (
        <Text size="sm" c="red">
          {error}
        </Text>
      ) : null}

      <Group justify="flex-end">
        {onCancel ? (
          <Button variant="subtle" onClick={onCancel}>
            انصراف
          </Button>
        ) : null}
        <Button loading={saving} onClick={save}>
          ثبت تغییر
        </Button>
      </Group>
    </Stack>
  );
}
