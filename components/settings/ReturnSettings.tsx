'use client';

import { useState } from 'react';
import { IconAlertCircle, IconArrowBackUp, IconCircleCheck } from '@tabler/icons-react';
import {
  Button,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { AppSettings } from '@/lib/settings';

export interface ReturnSettingsProps {
  initial: AppSettings;
}

/**
 * سیاست مرجوعی کالا (تنظیمات → مرجوعی کالا): کلید فعال‌سازی، مهلت درخواست به
 * روزِ از تحویل، پرداخت‌کننده پیش‌فرض هزینه ارسال برگشت و گزینه پیک مرجوعی.
 * هر چهار مقدار با یک PUT به /api/admin/settings ذخیره می‌شوند — تنظیمِ
 * هر درخواستِ مشخص (روش برگشت/پرداخت‌کننده) در صفحه خود درخواست انجام می‌شود.
 */
export default function ReturnSettings({ initial }: ReturnSettingsProps) {
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(initial.returnEnabled);
  const [windowDays, setWindowDays] = useState(initial.returnWindowDays);
  const [defaultPayer, setDefaultPayer] = useState(initial.returnDefaultShipPayer);
  const [courierEnabled, setCourierEnabled] = useState(initial.returnCourierEnabled);

  async function handleSubmit() {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnEnabled: enabled,
          returnWindowDays: String(windowDays ?? ''),
          returnDefaultShipPayer: defaultPayer,
          returnCourierEnabled: courierEnabled,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'ذخیره تنظیمات مرجوعی ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }

      notifications.show({
        title: 'ذخیره شد',
        message: 'تنظیمات مرجوعی کالا به‌روزرسانی شد.',
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
    } catch {
      notifications.show({
        title: 'خطا',
        message: 'ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card withBorder padding="md">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <Stack gap="md">
          <Group gap="xs" wrap="nowrap">
            <IconArrowBackUp size={18} />
            <Text size="sm" fw={600}>
              سیاست مرجوعی کالا
            </Text>
          </Group>

          <Switch
            label="فعال‌سازی مرجوعی کالا"
            description="با خاموش بودن، دکمه «درخواست مرجوعی» در سفارش‌های مشتریان نمایش داده نمی‌شود."
            checked={enabled}
            onChange={(event) => setEnabled(event.currentTarget.checked)}
          />

          <NumberInput
            label="مهلت مرجوعی (روز از تحویل)"
            description="مشتری تا این تعداد روز پس از تحویل سفارش می‌تواند درخواست مرجوعی ثبت کند."
            min={1}
            max={365}
            value={windowDays === '' ? '' : Number(windowDays)}
            onChange={(value) => setWindowDays(value === '' ? '' : String(value))}
            w={{ base: '100%', sm: 260 }}
          />

          <Stack gap={4}>
            <Text size="sm" fw={500}>
              پرداخت‌کننده پیش‌فرض هزینه ارسال برگشت
            </Text>
            <SegmentedControl
              fullWidth
              value={defaultPayer}
              onChange={setDefaultPayer}
              data={[
                { value: 'customer', label: 'مشتری' },
                { value: 'shop', label: 'فروشگاه' },
              ]}
            />
            <Text size="xs" c="dimmed">
              وقتی هزینه با فروشگاه است، مبلغ اعلامی مشتری پس از تایید مدارک به کیف پولش اضافه
              می‌شود. هنگام تایید هر درخواست می‌توانید این انتخاب را برای همان درخواست عوض کنید.
            </Text>
          </Stack>

          <Switch
            label="پیک مخصوص دریافت مرجوعی"
            description="با فعال بودن، هنگام تایید می‌توانید روش «جمع‌آوری توسط فروشگاه» را برای مشتری انتخاب کنید تا بسته از محل مشتری تحویل گرفته شود."
            checked={courierEnabled}
            onChange={(event) => setCourierEnabled(event.currentTarget.checked)}
          />

          <Group justify="flex-end">
            <Button type="submit" loading={saving}>
              ذخیره تنظیمات مرجوعی
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}
