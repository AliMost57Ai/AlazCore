'use client';

import { useState } from 'react';
import { IconAlertCircle, IconCircleCheck, IconSend } from '@tabler/icons-react';
import { Button, Card, NumberInput, Select, Stack, Switch, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { AppSettings } from '@/lib/settings';
import {
  WIDGET_ANIMATION_LABELS,
  WIDGET_ANIMATIONS,
  WIDGET_POSITION_LABELS,
  WIDGET_POSITIONS,
} from '@/lib/support-widget';

export interface SupportSettingsProps {
  initial: AppSettings;
}

/**
 * تنظیمات ← پشتیبانی: سوییچ چت فروشگاه، خوش‌آمدش و نحوه ورود دکمه شناور به
 * صفحه — پورت نسخه مرجع، با الگوی state سادهٔ ReturnSettings (فرم uncontrolled
 * با NumberInput رفتار ناپایدار داشت — مقداردهی دستی به form.values در
 * حالت uncontrolled به PUT نمی‌رسید).
 *
 * خاموش کردن پشتیبانی ویجت را از فروشگاه برمی‌دارد و API مشتری/مهمان را ۴۰۳
 * می‌کند — لیست تیکت‌های پنل به هر حال کار می‌کند تا تیکت‌های باز قابل پاسخ
 * بمانند. دو شمارنده ثانیه وقتی پشتیبانی خاموش است بی‌معنا هستند: خالی‌شان
 * به پیش‌فرض نرمال می‌شود و اعتبارسنجی سمت سرور هم فقط روی حالت روشن است.
 */
export default function SupportSettings({ initial }: SupportSettingsProps) {
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(initial.supportEnabled);
  const [welcome, setWelcome] = useState(initial.supportWelcome);
  const [position, setPosition] = useState(initial.supportWidgetPosition);
  const [animation, setAnimation] = useState(initial.supportWidgetAnimation);
  // رشته از ابتدا تا PUT — مثل returnWindowDays؛ NumberInput در لبه تبدیل می‌کند.
  const [delay, setDelay] = useState(initial.supportWidgetDelay);
  const [noticeEnabled, setNoticeEnabled] = useState(initial.supportWidgetNoticeEnabled);
  const [noticeSeconds, setNoticeSeconds] = useState(initial.supportWidgetNoticeSeconds);

  /** خالی/فضای خالی → پیش‌فرض مرجع؛ در غیر این صورت همان رشتهٔ عددی. */
  function secondsOr(raw: string, fallback: string): string {
    const trimmed = raw.trim();
    return trimmed === '' ? fallback : trimmed;
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supportEnabled: enabled,
          supportWelcome: welcome,
          supportWidgetPosition: position,
          supportWidgetAnimation: animation,
          supportWidgetDelay: secondsOr(delay, '0'),
          supportWidgetNoticeEnabled: noticeEnabled,
          supportWidgetNoticeSeconds: secondsOr(noticeSeconds, '8'),
        }),
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
    <Stack gap="md">
      <Card withBorder padding="md">
        <Stack gap="md">
          <Switch
            label="فعال بودن پشتیبانی آنلاین"
            description="وقتی خاموش باشد، دکمهٔ گفتگو از فروشگاه برداشته می‌شود و مشتری/مهمان نمی‌تواند تیکت تازه بفرستد. تیکت‌های باز در پنل پشتیبانی همچنان قابل پاسخ هستند."
            labelPosition="left"
            checked={enabled}
            onChange={(event) => setEnabled(event.currentTarget.checked)}
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
            value={welcome}
            onChange={(event) => setWelcome(event.currentTarget.value)}
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
            value={position}
            onChange={(value) => setPosition(value ?? 'bottom-left')}
          />
          <Select
            label="انیمیشن نمایش"
            description="نحوهٔ ظاهر شدن آیکون بعد از باز شدن صفحه."
            data={WIDGET_ANIMATIONS.map((value) => ({
              value,
              label: WIDGET_ANIMATION_LABELS[value],
            }))}
            allowDeselect={false}
            value={animation}
            onChange={(value) => setAnimation(value ?? 'fade')}
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
            value={delay === '' ? '' : Number(delay)}
            onChange={(value) => setDelay(value === '' ? '' : String(value))}
          />
          <Switch
            label="نمایش پیام خوش‌آمد"
            description="متن خوش‌آمد به‌صورت حباب کنار آیکون نمایش داده می‌شود و خودکار بسته می‌شود — در هر نشست فقط یک‌بار."
            labelPosition="left"
            checked={noticeEnabled}
            onChange={(event) => setNoticeEnabled(event.currentTarget.checked)}
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
            value={noticeSeconds === '' ? '' : Number(noticeSeconds)}
            onChange={(value) => setNoticeSeconds(value === '' ? '' : String(value))}
          />
        </Stack>
      </Card>

      <Button
        type="submit"
        loading={saving}
        onClick={() => void handleSubmit()}
        leftSection={<IconSend size={16} />}
        style={{ alignSelf: 'flex-end' }}
      >
        ذخیره تنظیمات پشتیبانی
      </Button>
    </Stack>
  );
}
