'use client';

import { useState } from 'react';
import {
  IconAlertCircle,
  IconCircleCheck,
  IconDeviceMobile,
  IconShieldLock,
} from '@tabler/icons-react';
import { Button, Card, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { AppSettings } from '@/lib/settings';

export interface SecuritySettingsProps {
  initial: AppSettings;
}

/**
 * The site-wide sign-in policy (تنظیمات → امنیت سامانه): whether each
 * customer picks their own login method, or two-step / code-only sign-in is
 * forced on every account. Forcing a method locks the customer's own choice
 * in their storefront profile. The login OTP SMS text itself is configured on
 * the الگوهای پیامکی page.
 */
export default function SecuritySettings({ initial }: SecuritySettingsProps) {
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState(initial.loginPolicy);

  async function handleSubmit() {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginPolicy: policy }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'ذخیره سیاست ورود ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }

      notifications.show({
        title: 'ذخیره شد',
        message: 'سیاست ورود سایت به‌روزرسانی شد.',
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
            <IconShieldLock size={18} />
            <Text size="sm" fw={600}>
              سیاست ورود سایت
            </Text>
          </Group>

          <SegmentedControl
            fullWidth
            value={policy}
            onChange={setPolicy}
            data={[
              { value: '', label: 'انتخاب کاربر' },
              { value: 'password', label: 'همه فقط گذرواژه' },
              { value: 'twostep', label: 'همه دو مرحله‌ای' },
              { value: 'otp', label: 'همه رمز یکبار مصرف' },
            ]}
          />

          <Text size="xs" c="dimmed">
            در حالت «انتخاب کاربر» هر مشتری روش ورود خود را در پروفایلش (/account) برمی‌گزیند.
            حالت‌های «دو مرحله‌ای» و «رمز یکبار مصرف» برای همه اجباری می‌شوند و انتخاب کاربر غیرفعال
            می‌شود. (حالت «همه فقط گذرواژه» همان رفتار پیش‌فرض است.)
          </Text>

          <Text size="xs" c="dimmed">
            <IconDeviceMobile size={14} style={{ verticalAlign: -2 }} /> متن و الگوی پیامک کد ورود
            در صفحه «الگوهای پیامکی» تنظیم می‌شود.
          </Text>

          <Group justify="flex-end">
            <Button type="submit" loading={saving}>
              ذخیره سیاست ورود
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}
