'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconAlertCircle, IconIdBadge2, IconLock, IconPhone, IconUser } from '@tabler/icons-react';
import { Alert, Button, Group, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import PhoneInput from '@/components/ui/PhoneInput';
import { fromFaDigits } from '@/lib/format';

/** Iranian mobile: starts with 09, exactly 11 digits. */
const PHONE_PATTERN = /^09\d{9}$/;

/** Iranian national ID: exactly 10 digits. */
const NATIONAL_ID_PATTERN = /^\d{10}$/;

export interface SignupFormProps {
  /** Called on success when rendered inside a modal instead of the page. */
  onDone?: () => void;
  /** True when the admin enabled Shahkar matching (کد ملی becomes required). */
  requireNationalId?: boolean;
}

export default function SignupForm({ onDone, requireNationalId = false }: SignupFormProps = {}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { name: '', phone: '', nationalId: '', password: '', confirmPassword: '' },
    validate: {
      name: (value) => (value.trim().length >= 2 ? null : 'نام باید حداقل ۲ نویسه باشد.'),
      phone: (value) =>
        PHONE_PATTERN.test(fromFaDigits(value).replace(/[\s()-]/g, ''))
          ? null
          : 'شماره موبایل باید با ۰۹ شروع شود و دقیقاً ۱۱ رقم باشد.',
      nationalId: (value) => {
        if (!requireNationalId) {
          return null;
        }
        return NATIONAL_ID_PATTERN.test(fromFaDigits(value).trim())
          ? null
          : 'کد ملی باید دقیقاً ۱۰ رقم باشد.';
      },
      password: (value) => (value.length >= 8 ? null : 'گذرواژه باید حداقل ۸ نویسه باشد.'),
      confirmPassword: (value, values) =>
        value === values.password ? null : 'تکرار گذرواژه با گذرواژه یکسان نیست.',
    },
  });

  async function handleSubmit(values: typeof form.values) {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          phone: fromFaDigits(values.phone).replace(/[\s()-]/g, ''),
          ...(requireNationalId ? { nationalId: fromFaDigits(values.nationalId).trim() } : {}),
          password: values.password,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? 'ثبت‌نام ناموفق بود. لطفاً دوباره تلاش کنید.');
        return;
      }

      // Signup signs you in — land on the storefront.
      notifications.show({
        title: 'خوش آمدید!',
        message: 'حساب شما ساخته شد.',
        color: 'green',
      });
      if (onDone) {
        // Modal context: let the caller close/switch; the refresh below still
        // re-renders server pages with the new session.
        onDone();
      } else {
        router.replace('/');
      }
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
          <Alert
            variant="light"
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="ثبت‌نام انجام نشد"
          >
            {error}
          </Alert>
        ) : null}

        <TextInput
          label="نام و نام خانوادگی"
          placeholder="مثلاً سارا محمدی"
          autoComplete="name"
          leftSection={<IconUser size={18} />}
          required
          key={form.key('name')}
          {...form.getInputProps('name')}
        />

        <PhoneInput
          label="شماره موبایل"
          description="با ۰۹ شروع می‌شود و ۱۱ رقم است — این شماره نام کاربری شماست."
          placeholder="۰۹۱۲۱۲۳۴۵۶۷"
          leftSection={<IconPhone size={18} />}
          required
          key={form.key('phone')}
          {...form.getInputProps('phone')}
        />

        {requireNationalId ? (
          <TextInput
            label="کد ملی"
            description="برای تأیید مالکیت شماره موبایل، با سرویس شاهکار تطبیق داده می‌شود."
            placeholder="۱۰ رقم"
            dir="ltr"
            inputMode="numeric"
            maxLength={10}
            leftSection={<IconIdBadge2 size={18} />}
            required
            key={form.key('nationalId')}
            {...form.getInputProps('nationalId')}
          />
        ) : null}

        <PasswordInput
          label="گذرواژه"
          placeholder="حداقل ۸ نویسه"
          autoComplete="new-password"
          leftSection={<IconLock size={18} />}
          required
          key={form.key('password')}
          {...form.getInputProps('password')}
        />

        <PasswordInput
          label="تکرار گذرواژه"
          placeholder="گذرواژه را دوباره وارد کنید"
          autoComplete="new-password"
          leftSection={<IconLock size={18} />}
          required
          key={form.key('confirmPassword')}
          {...form.getInputProps('confirmPassword')}
        />

        <Button type="submit" size="md" fullWidth loading={submitting}>
          ساخت حساب
        </Button>

        <Group justify="center" gap={4}>
          <Text size="sm" c="dimmed">
            قبلاً ثبت‌نام کرده‌اید؟
          </Text>
          <Text component="a" href="/login" size="sm" c="brand" style={{ cursor: 'pointer' }}>
            ورود به حساب
          </Text>
        </Group>
      </Stack>
    </form>
  );
}
