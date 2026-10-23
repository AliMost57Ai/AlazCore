'use client';

import { useState } from 'react';
import { IconAlertCircle, IconCircleCheck, IconSend } from '@tabler/icons-react';
import { Button, Card, NumberInput, Select, Stack, Switch, Text, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import type { AppSettings } from '@/lib/settings';
import {
  WIDGET_ANIMATION_LABELS,
  WIDGET_ANIMATIONS,
  WIDGET_POSITION_LABELS,
  WIDGET_POSITIONS,
} from '@/lib/support-status';

export interface SupportSettingsProps {
  initial: AppSettings;
}

/** The two second-counts are stored as strings (FIELD_SPECS has no numeric kind). */
function secondsField(raw: string): number | '' {
  const trimmed = raw.trim();
  return trimmed === '' ? '' : Number(trimmed);
}

/**
 * تنظیمات → پشتیبانی: the storefront chat switch, its greeting and how the
 * floating button arrives on the page.
 *
 * Switching support off hides the widget from the storefront and makes the
 * customer/guest support API answer 403 — the panel's own ticket list keeps
 * working either way, so tickets already open can still be answered.
 */
export default function SupportSettings({ initial }: SupportSettingsProps) {
  const [saving, setSaving] = useState(false);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      supportEnabled: initial.supportEnabled,
      supportWelcome: initial.supportWelcome,
      supportWidgetPosition: initial.supportWidgetPosition,
      supportWidgetAnimation: initial.supportWidgetAnimation,
      // Kept as strings all the way to the API — NumberInput speaks numbers, so
      // its own handlers convert at the edge (see the props below).
      supportWidgetDelay: initial.supportWidgetDelay,
      supportWidgetNoticeEnabled: initial.supportWidgetNoticeEnabled,
      supportWidgetNoticeSeconds: initial.supportWidgetNoticeSeconds,
    },
  });

  async function handleSubmit(values: typeof form.values) {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'ذخیره تنظیمات پشتیبانی ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }

      notifications.show({
        title: 'ذخیره شد',
        message: 'تنظیمات پشتیبانی به‌روزرسانی شد.',
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
    <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <Stack gap="md">
        <Card withBorder padding="md">
          <Stack gap="md">
            <Switch
              label="فعال بودن پشتیبانی آنلاین"
              description="وقتی خاموش باشد، دکمهٔ گفتگو از فروشگاه برداشته می‌شود و مشتری/مهمان نمی‌تواند تیکت تازه بفرستد. تیکت‌های باز در پنل پشتیبانی همچنان قابل پاسخ هستند."
              labelPosition="left"
              key={form.key('supportEnabled')}
              {...form.getInputProps('supportEnabled', { type: 'checkbox' })}
            />
          </Stack>
        </Card>

        <Card withBorder padding="md">
          <Stack gap="md">
            <Text size="sm" fw={600}>
              متن خوش‌آمد
            </Text>
            <Textarea
              label="پیامی که در ابتدای گفتگو نمایش داده می‌شود"
              description="خالی بگذارید تا متن پیش‌فرض استفاده شود. حداکثر ۳۰۰ نویسه."
              placeholder="سلام! چطور می‌توانیم کمکتان کنیم؟"
              autosize
              minRows={2}
              maxLength={300}
              key={form.key('supportWelcome')}
              {...form.getInputProps('supportWelcome')}
            />
          </Stack>
        </Card>

        <Card withBorder padding="md">
          <Stack gap="md">
            <Text size="sm" fw={600}>
              نمایش ویجت در فروشگاه
            </Text>
            <Select
              label="جای آیکون"
              description="گوشه‌ای از صفحه که دکمهٔ گفتگو در آن می‌نشیند."
              data={WIDGET_POSITIONS.map((value) => ({
                value,
                label: WIDGET_POSITION_LABELS[value],
              }))}
              allowDeselect={false}
              key={form.key('supportWidgetPosition')}
              {...form.getInputProps('supportWidgetPosition')}
            />
            <Select
              label="انیمیشن نمایش"
              description="نحوهٔ ظاهر شدن آیکون بعد از باز شدن صفحه."
              data={WIDGET_ANIMATIONS.map((value) => ({
                value,
                label: WIDGET_ANIMATION_LABELS[value],
              }))}
              allowDeselect={false}
              key={form.key('supportWidgetAnimation')}
              {...form.getInputProps('supportWidgetAnimation')}
            />
            <NumberInput
              label="تأخیر نمایش آیکون (ثانیه)"
              description="چند ثانیه بعد از باز شدن صفحه، آیکون ظاهر شود. ۰ = بی‌درنگ."
              min={0}
              max={999}
              step={1}
              clampBehavior="strict"
              allowNegative={false}
              dir="ltr"
              key={form.key('supportWidgetDelay')}
              defaultValue={secondsField(initial.supportWidgetDelay)}
              onChange={(value) => form.setFieldValue('supportWidgetDelay', String(value))}
            />
            <Switch
              label="نمایش پیام خوش‌آمد"
              description="متن خوش‌آمد به‌صورت حباب کنار آیکون نمایش داده می‌شود و خودکار بسته می‌شود — در هر نشست فقط یک‌بار."
              labelPosition="left"
              key={form.key('supportWidgetNoticeEnabled')}
              {...form.getInputProps('supportWidgetNoticeEnabled', { type: 'checkbox' })}
            />
            <NumberInput
              label="مدت نمایش پیام خوش‌آمد (ثانیه)"
              description="بعد از این مدت خودکار بسته می‌شود. ۰ = تا بستن دستی باز می‌ماند."
              min={0}
              max={999}
              step={1}
              clampBehavior="strict"
              allowNegative={false}
              dir="ltr"
              key={form.key('supportWidgetNoticeSeconds')}
              defaultValue={secondsField(initial.supportWidgetNoticeSeconds)}
              onChange={(value) => form.setFieldValue('supportWidgetNoticeSeconds', String(value))}
            />
          </Stack>
        </Card>

        <Button
          type="submit"
          loading={saving}
          leftSection={<IconSend size={16} />}
          style={{ alignSelf: 'flex-end' }}
        >
          ذخیره تنظیمات پشتیبانی
        </Button>
      </Stack>
    </form>
  );
}
