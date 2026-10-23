'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconCalendarOff, IconMapPin, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import EmptyState from '@/components/layout/EmptyState';
import { PersianDateTimePicker } from '@/components/PersianDateTimePicker/PersianDateTimePicker';
import { minutesToTime } from '@/components/settings/PickupLocationForm';
import { enNumber } from '@/lib/format';
import type { PickupHolidayDTO, PickupLocationDTO } from '@/lib/pickup';

/**
 * مدیریت تحویل حضوری — نقاط مراجعه با بازه‌های زمانی و ظرفیت، و روزهای
 * تعطیل. ایجاد/ویرایش نقطه روی صفحات اختصاصی (فرم بیش از ۴ فیلد مودال باز
 * نمی‌شود)؛ حذف و تعطیل‌ها همین‌جاست. REST /api/settings/pickup.
 */
export default function PickupManager() {
  const router = useRouter();
  const [locations, setLocations] = useState<PickupLocationDTO[]>([]);
  const [holidays, setHolidays] = useState<PickupHolidayDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayTitle, setHolidayTitle] = useState('');
  const [deleting, setDeleting] = useState<PickupLocationDTO | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/pickup');
      if (response.ok) {
        const payload = (await response.json()) as {
          locations: PickupLocationDTO[];
          holidays: PickupHolidayDTO[];
        };
        setLocations(payload.locations);
        setHolidays(payload.holidays);
      }
    } catch {
      // لیست خالی می‌ماند؛ دوباره تلاش با رفرش صفحه.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(location: PickupLocationDTO) {
    const response = await fetch(`/api/settings/pickup?id=${encodeURIComponent(location.id)}`, {
      method: 'DELETE',
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      notifications.show({ message: payload.error ?? 'حذف ناموفق بود.', color: 'red' });
      return;
    }
    notifications.show({ message: 'نقطه تحویل حذف شد.', color: 'green' });
    setDeleting(null);
    await load();
  }

  async function addHoliday() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDate.trim())) {
      notifications.show({
        message: 'تاریخ را به شکل میلادی YYYY-MM-DD وارد کنید.',
        color: 'orange',
      });
      return;
    }
    const response = await fetch('/api/settings/pickup/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: holidayDate.trim(), title: holidayTitle }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      notifications.show({ message: payload.error ?? 'ثبت تعطیل ناموفق بود.', color: 'red' });
      return;
    }
    setHolidayDate('');
    setHolidayTitle('');
    await load();
  }

  async function removeHoliday(id: string) {
    const response = await fetch(`/api/settings/pickup/holidays?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      await load();
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" wrap="nowrap">
        <Text fw={600}>نقاط تحویل حضوری</Text>
        <Button
          radius="xl"
          leftSection={<IconPlus size={16} />}
          onClick={() => router.push('/settings/pickup/locations/new')}
        >
          نقطه جدید
        </Button>
      </Group>

      {loading ? (
        <Text size="sm" c="dimmed">
          در حال بارگذاری…
        </Text>
      ) : locations.length === 0 ? (
        <Card withBorder padding="lg">
          <EmptyState
            icon={IconMapPin}
            message="هنوز نقطه‌ای تعریف نشده است."
            hint="اولین نقطه مراجعه را با آدرس و بازه‌های زمانی‌اش بسازید."
          />
        </Card>
      ) : (
        <Stack gap="sm">
          {locations.map((location) => (
            <Card key={location.id} padding="lg" withBorder>
              <Group justify="space-between" wrap="nowrap" gap="xs" mb={6}>
                <Stack gap={2}>
                  <Group gap="xs" wrap="nowrap">
                    <Text fw={600}>{location.title}</Text>
                    {location.isActive ? (
                      <Badge variant="light" color="green" size="sm">
                        فعال
                      </Badge>
                    ) : (
                      <Badge variant="light" color="gray" size="sm">
                        غیرفعال
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {location.address}
                    {location.lat !== null && location.lng !== null
                      ? ` — موقعیت: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
                      : ''}
                  </Text>
                </Stack>
                <Group gap="xs" wrap="nowrap">
                  <Tooltip label="ویرایش">
                    <ActionIcon
                      variant="default"
                      onClick={() => router.push(`/settings/pickup/locations/${location.id}/edit`)}
                      aria-label={`ویرایش ${location.title}`}
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="حذف">
                    <ActionIcon
                      variant="default"
                      color="red"
                      onClick={() => setDeleting(location)}
                      aria-label={`حذف ${location.title}`}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
              <Group gap="xs" wrap="wrap" mt={4}>
                {location.slots.length === 0 ? (
                  <Text size="xs" c="dimmed">
                    بازه زمانی تعریف نشده.
                  </Text>
                ) : (
                  location.slots.map((slot) => (
                    <Badge key={slot.id} variant="light" color="blue" radius="sm" size="lg">
                      {minutesToTime(slot.startMinute)}–{minutesToTime(slot.endMinute)} · ظرفیت{' '}
                      {enNumber(slot.capacity)}
                    </Badge>
                  ))
                )}
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Card padding="lg" withBorder>
        <Group gap="xs" wrap="nowrap" mb="sm">
          <IconCalendarOff size={18} stroke={1.8} />
          <Text fw={600}>روزهای تعطیل</Text>
        </Group>
        <Text size="xs" c="dimmed" mb="sm">
          در روزهای تعطیل، رزرو تحویل حضوری برای همه نقاط بسته است.
        </Text>
        <Group gap="xs" align="flex-end" wrap="wrap">
          <PersianDateTimePicker
            label="تاریخ تعطیل"
            placeholder="انتخاب روز"
            size="half"
            value={holidayDate ? `${holidayDate}T00:00:00` : null}
            valueFormat="YYYY-MM-DD"
            dateFormat="numeric"
            showTime={false}
            clearable
            onChange={(date) => {
              setHolidayDate(typeof date === 'string' ? date : '');
            }}
          />
          <TextInput
            label="توضیح (اختیاری)"
            placeholder="تعطیل رسمی"
            value={holidayTitle}
            onChange={(event) => setHolidayTitle(event.currentTarget.value)}
            style={{ flex: '1 1 180px' }}
          />
          <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addHoliday}>
            افزودن تعطیل
          </Button>
        </Group>
        {holidays.length > 0 ? (
          <Group gap="xs" mt="md" wrap="wrap">
            {holidays.map((holiday) => (
              <Badge
                key={holiday.id}
                variant="light"
                color="red"
                size="lg"
                rightSection={
                  <ActionIcon
                    size="xs"
                    variant="transparent"
                    color="red"
                    aria-label={`حذف تعطیل ${holiday.date}`}
                    onClick={() => removeHoliday(holiday.id)}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                }
              >
                {holiday.date}
                {holiday.title ? ` — ${holiday.title}` : ''}
              </Badge>
            ))}
          </Group>
        ) : null}
      </Card>

      <Modal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف نقطه تحویل"
        radius="lg"
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            نقطه «{deleting?.title}» و همه بازه‌های زمانی‌اش حذف شود؟ روش ارسالِ تحویل حضوریِ همین
            نقطه هم غیرفعال خواهد شد.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleting(null)}>
              انصراف
            </Button>
            <Button
              color="red"
              onClick={() => {
                if (deleting) {
                  void remove(deleting);
                }
              }}
            >
              حذف
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
