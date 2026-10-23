'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconAlertCircle, IconCircleCheck, IconDeviceMobile, IconUser } from '@tabler/icons-react';
import { Alert, Button, SegmentedControl, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { fromFaDigits } from '@/lib/format';

export interface ProfileFormProps {
  name: string;
  phone: string;
  /** The customer's own sign-in method ('password' | 'twostep' | 'otp'). */
  loginMethod: string;
  /** True while the admin's site-wide policy forces the method on everyone. */
  loginMethodLocked: boolean;
}

const LOGIN_METHOD_OPTIONS = [
  { value: 'password', label: 'فقط گذرواژه' },
  { value: 'twostep', label: 'دو مرحله‌ای' },
  { value: 'otp', label: 'رمز یکبار مصرف' },
];

/** Customer profile: editable full name, read-only phone username, sign-in method. */
export default function ProfileForm({
  name,
  phone,
  loginMethod,
  loginMethodLocked,
}: ProfileFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { name, loginMethod },
    validate: {
      name: (value) =>
        value.trim().length >= 3 ? null : 'نام و نام خانوادگی باید حداقل ۳ نویسه باشد.',
    },
  });

  async function handleSubmit(values: typeof form.values) {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name.trim(), loginMethod: values.loginMethod }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? 'ذخیره ناموفق بود.');
        return;
      }

      notifications.show({
        title: 'ذخیره شد',
        message: 'اطلاعات حساب شما به‌روزرسانی شد.',
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
      // The session cookie was re-signed — pull the new name into the UI.
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <Stack gap="md">
        {error ? (
          <Alert variant="light" color="red" icon={<IconAlertCircle size={18} />} title="خطا">
            {error}
          </Alert>
        ) : null}

        <TextInput
          label="شماره موبایل (نام کاربری)"
          description="شماره موبایل قابل تغییر نیست."
          value={fromFaDigits(phone)}
          readOnly
          leftSection={<IconDeviceMobile size={18} />}
          dir="ltr"
          styles={{ input: { textAlign: 'start' } }}
        />

        <TextInput
          label="نام و نام خانوادگی"
          placeholder="مثلاً سارا محمدی"
          leftSection={<IconUser size={18} />}
          required
          key={form.key('name')}
          {...form.getInputProps('name')}
        />

        <Stack gap={4}>
          <Text size="sm" fw={500}>
            روش ورود
          </Text>
          <SegmentedControl
            fullWidth
            disabled={loginMethodLocked}
            data={LOGIN_METHOD_OPTIONS}
            key={form.key('loginMethod')}
            {...form.getInputProps('loginMethod')}
          />
          <Text size="xs" c="dimmed">
            {loginMethodLocked
              ? 'روش ورود توسط مدیر سایت اجباری شده است.'
              : '«دو مرحله‌ای» یعنی پس از گذرواژه، یک رمز یکبار مصرف هم می‌رسد؛ «رمز یکبار مصرف» یعنی بدون گذرواژه فقط با کد وارد می‌شوید.'}
          </Text>
        </Stack>

        <Button type="submit" loading={submitting}>
          ذخیره تغییرات
        </Button>
      </Stack>
    </form>
  );
}
