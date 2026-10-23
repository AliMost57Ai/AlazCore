'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconCheck, IconLogout } from '@tabler/icons-react';
import { Button, Card, Group, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';

export interface ProfileSettingsProps {
  name: string;
  email: string;
}

export default function ProfileSettings({ name, email }: ProfileSettingsProps) {
  const [saving, setSaving] = useState(false);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { name },
    validate: {
      name: (value) => (value.trim().length >= 3 ? null : 'نام باید حداقل ۳ نویسه باشد.'),
    },
  });

  async function handleSubmit(values: { name: string }) {
    setSaving(true);
    try {
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'ذخیره تغییرات ناموفق بود.',
          color: 'red',
        });
        return;
      }

      notifications.show({
        title: 'ذخیره شد',
        message: 'تغییرات حساب کاربری با موفقیت ثبت شد.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch {
      notifications.show({
        title: 'خطا',
        message: 'ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <Text fw={600} mb="lg">
        حساب کاربری
      </Text>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="نام و نام خانوادگی"
            key={form.key('name')}
            {...form.getInputProps('name')}
          />

          <TextInput
            label="ایمیل"
            value={email}
            dir="ltr"
            readOnly
            disabled
            description="برای تغییر ایمیل با پشتیبانی تماس بگیرید."
          />

          {/* Staff (email) accounts always sign in with their password — the
              sign-in method choice belongs to customers on the storefront
              (/account) and to the admin policy (تنظیمات ← امنیت سامانه). */}

          <Group justify="flex-end">
            <Button type="submit" loading={saving}>
              ذخیره تغییرات
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}

export function SessionSettings() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <Card>
      <Text fw={600} mb="xs">
        توجه
      </Text>
      <Text size="sm" c="dimmed" mb="lg">
        آیا از حساب کاربری خود خارج می شوید؟
      </Text>

      <Button
        color="red"
        variant="light"
        leftSection={<IconLogout size={16} />}
        loading={signingOut}
        onClick={handleSignOut}
      >
        خروج
      </Button>
    </Card>
  );
}
