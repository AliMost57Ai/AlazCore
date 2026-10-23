'use client';

import { useState } from 'react';
import { IconAlertCircle, IconCircleCheck, IconSend } from '@tabler/icons-react';
import { Button, Card, Divider, Stack, Switch, Text, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import type { AppSettings } from '@/lib/settings';

export interface ShahkarSettingsProps {
  initial: AppSettings;
}

/**
 * تنظیمات → شاهکار: the PGSB Shahkar service credentials. When the switch is
 * on, signup asks for the national ID code and matches it against the mobile
 * number at the provider (lib/shahkar.ts) before creating the account.
 */
export default function ShahkarSettings({ initial }: ShahkarSettingsProps) {
  const [saving, setSaving] = useState(false);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      shahkarEnabled: initial.shahkarEnabled,
      shahkarBaseUrl: initial.shahkarBaseUrl,
      shahkarBasicKey: initial.shahkarBasicKey,
      shahkarUsername: initial.shahkarUsername,
      shahkarPassword: initial.shahkarPassword,
      shahkarPid: initial.shahkarPid,
      shahkarBasicAuthKey: initial.shahkarBasicAuthKey,
      shahkarPublicKeyPem: initial.shahkarPublicKeyPem,
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
          message: payload.error ?? 'ذخیره تنظیمات شاهکار ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }

      notifications.show({
        title: 'ذخیره شد',
        message: 'تنظیمات شاهکار به‌روزرسانی شد.',
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
              label="فعال‌سازی تطبیق شاهکار در ثبت‌نام"
              description="وقتی روشن باشد، ثبت‌نام مشتری نیازمند کد ملی است و تطبیق شماره موبایل با کد ملی از سرویس شاهکار گرفته می‌شود."
              labelPosition="left"
              key={form.key('shahkarEnabled')}
              {...form.getInputProps('shahkarEnabled', { type: 'checkbox' })}
            />
          </Stack>
        </Card>

        <Card withBorder padding="md">
          <Stack gap="md">
            <Text size="sm" fw={600}>
              کلیدهای سرویس (PGSB)
            </Text>
            <TextInput
              label="آدرس سرویس"
              description="پیش‌فرض: https://op1.pgsb.ir — فقط در صورت دستور ارائه‌دهنده تغییر دهید."
              placeholder="https://op1.pgsb.ir"
              dir="ltr"
              key={form.key('shahkarBaseUrl')}
              {...form.getInputProps('shahkarBaseUrl')}
            />
            <TextInput
              label="کلید Basic سرویس توکن"
              description="مقدار هدر Authorization در درخواست oauth/token (بدون واژهٔ «Basic»)."
              placeholder="base64-key"
              dir="ltr"
              key={form.key('shahkarBasicKey')}
              {...form.getInputProps('shahkarBasicKey')}
            />
            <TextInput
              label="نام کاربری"
              placeholder="username"
              dir="ltr"
              key={form.key('shahkarUsername')}
              {...form.getInputProps('shahkarUsername')}
            />
            <TextInput
              label="رمز عبور"
              placeholder="password"
              dir="ltr"
              key={form.key('shahkarPassword')}
              {...form.getInputProps('shahkarPassword')}
            />
            <Divider labelPosition="center" label="سرویس تطبیق" />
            <TextInput
              label="کلید pid"
              description="مقدار هدر pid در درخواست serviceIDmatchingencrypted."
              placeholder="pid-key"
              dir="ltr"
              key={form.key('shahkarPid')}
              {...form.getInputProps('shahkarPid')}
            />
            <TextInput
              label="کلید basicAuthorization"
              description="مقدار هدر basicAuthorization در درخواست تطبیق (بدون واژهٔ «Basic»)."
              placeholder="basic-auth-key"
              dir="ltr"
              key={form.key('shahkarBasicAuthKey')}
              {...form.getInputProps('shahkarBasicAuthKey')}
            />
            <Textarea
              label="کلید عمومی EC (PEM)"
              description="کلید عمومی الیپتیک ارائه‌دهنده (فایل ECpublicKey.pem) — کد ملی و شماره موبایل با همین کلید رمزنگاری می‌شوند."
              placeholder="-----BEGIN PUBLIC KEY-----"
              autosize
              minRows={5}
              dir="ltr"
              styles={{
                input: {
                  textAlign: 'start',
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  fontSize: 12,
                },
              }}
              key={form.key('shahkarPublicKeyPem')}
              {...form.getInputProps('shahkarPublicKeyPem')}
            />
          </Stack>
        </Card>

        <Button
          type="submit"
          loading={saving}
          leftSection={<IconSend size={16} />}
          style={{ alignSelf: 'flex-end' }}
        >
          ذخیره تنظیمات شاهکار
        </Button>
      </Stack>
    </form>
  );
}
