'use client';

import { useState } from 'react';
import { IconAlertCircle, IconCircleCheck, IconLock } from '@tabler/icons-react';
import { Alert, Button, PasswordInput, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';

/** Change password: verifies the current one server-side. */
export default function ChangePasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    validate: {
      currentPassword: (value) => (value.length >= 1 ? null : 'گذرواژه فعلی را وارد کنید.'),
      newPassword: (value) => (value.length >= 8 ? null : 'گذرواژه جدید باید حداقل ۸ نویسه باشد.'),
      confirmPassword: (value, values) =>
        value === values.newPassword ? null : 'تکرار گذرواژه با گذرواژه جدید یکسان نیست.',
    },
  });

  async function handleSubmit(values: typeof form.values) {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? 'تغییر گذرواژه ناموفق بود.');
        return;
      }

      form.reset();
      notifications.show({
        title: 'گذرواژه تغییر کرد',
        message: 'از این پس با گذرواژه جدید وارد شوید.',
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
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

        <PasswordInput
          label="گذرواژه فعلی"
          placeholder="گذرواژه کنونی خود را وارد کنید"
          autoComplete="current-password"
          leftSection={<IconLock size={18} />}
          required
          key={form.key('currentPassword')}
          {...form.getInputProps('currentPassword')}
        />

        <PasswordInput
          label="گذرواژه جدید"
          placeholder="حداقل ۸ نویسه"
          autoComplete="new-password"
          leftSection={<IconLock size={18} />}
          required
          key={form.key('newPassword')}
          {...form.getInputProps('newPassword')}
        />

        <PasswordInput
          label="تکرار گذرواژه جدید"
          placeholder="گذرواژه جدید را دوباره وارد کنید"
          autoComplete="new-password"
          leftSection={<IconLock size={18} />}
          required
          key={form.key('confirmPassword')}
          {...form.getInputProps('confirmPassword')}
        />

        <Button type="submit" loading={submitting}>
          تغییر گذرواژه
        </Button>
      </Stack>
    </form>
  );
}
