'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconAlertCircle, IconCircleCheck, IconLock, IconPhone } from '@tabler/icons-react';
import {
  Alert,
  Anchor,
  Button,
  Code,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import PhoneInput from '@/components/ui/PhoneInput';
import { fromFaDigits } from '@/lib/format';

/** Iranian mobile: starts with 09, exactly 11 digits. */
const PHONE_PATTERN = /^09\d{9}$/;

/**
 * Two-step recovery: request a 6-digit code for the account's phone, then
 * submit the code with a new password. The code arrives via the forgot API —
 * in production that means SMS; in development it is returned inline (devCode)
 * so the flow stays testable without a provider.
 */
export default function ForgotPasswordForm({ onDone }: { onDone?: () => void } = {}) {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const requestForm = useForm({
    mode: 'uncontrolled',
    initialValues: { phone: '' },
    validate: {
      phone: (value) =>
        PHONE_PATTERN.test(fromFaDigits(value).replace(/[\s()-]/g, ''))
          ? null
          : 'شماره موبایل باید با ۰۹ شروع شود و دقیقاً ۱۱ رقم باشد.',
    },
  });

  const resetForm = useForm({
    mode: 'uncontrolled',
    initialValues: { code: '', password: '', confirmPassword: '' },
    validate: {
      code: (value) =>
        /^\d{6}$/.test(fromFaDigits(value)) ? null : 'کد ۶ رقمی پیامک‌شده را وارد کنید.',
      password: (value) => (value.length >= 8 ? null : 'گذرواژه باید حداقل ۸ نویسه باشد.'),
      confirmPassword: (value, values) =>
        value === values.password ? null : 'تکرار گذرواژه با گذرواژه یکسان نیست.',
    },
  });

  const phone = fromFaDigits(requestForm.getValues().phone).replace(/[\s()-]/g, '');

  async function handleRequest(values: typeof requestForm.values) {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fromFaDigits(values.phone).replace(/[\s()-]/g, '') }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        devCode?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? 'درخواست کد ناموفق بود.');
        return;
      }

      setDevCode(payload.devCode ?? null);
      setStep('reset');
    } catch {
      setError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(values: typeof resetForm.values) {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          code: fromFaDigits(values.code),
          password: values.password,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? 'تغییر گذرواژه ناموفق بود.');
        return;
      }

      notifications.show({
        title: 'گذرواژه تغییر کرد',
        message: 'اکنون می‌توانید با گذرواژه جدید وارد شوید.',
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
      if (onDone) {
        // Modal context: caller switches back to the login step.
        onDone();
      } else {
        router.replace('/login');
      }
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'request') {
    return (
      <form onSubmit={requestForm.onSubmit(handleRequest)} noValidate>
        <Stack gap="md">
          {error ? (
            <Alert variant="light" color="red" icon={<IconAlertCircle size={18} />} title="خطا">
              {error}
            </Alert>
          ) : null}

          <PhoneInput
            label="شماره موبایل حساب"
            description="کد بازیابی برای این شماره ارسال می‌شود."
            placeholder="۰۹۱۲۱۲۳۴۵۶۷"
            leftSection={<IconPhone size={18} />}
            required
            key={requestForm.key('phone')}
            {...requestForm.getInputProps('phone')}
          />

          <Button type="submit" size="md" fullWidth loading={submitting}>
            دریافت کد بازیابی
          </Button>

          <Text size="sm" c="dimmed" ta="center">
            <Anchor href="/login" c="brand">
              بازگشت به ورود
            </Anchor>
          </Text>
        </Stack>
      </form>
    );
  }

  return (
    <form onSubmit={resetForm.onSubmit(handleReset)} noValidate>
      <Stack gap="md">
        {error ? (
          <Alert variant="light" color="red" icon={<IconAlertCircle size={18} />} title="خطا">
            {error}
          </Alert>
        ) : null}

        {devCode ? (
          <Alert variant="light" color="orange" title="حالت توسعه (بدون اتصال پیامکی)">
            کد بازیابی شما: <Code dir="ltr">{devCode}</Code> — در محیط واقعی این کد با پیامک برای
            شما ارسال می‌شود.
          </Alert>
        ) : null}

        <Text size="sm" c="dimmed">
          کد ۶ رقمی ارسال‌شده به{' '}
          <Text span fw={700} dir="ltr">
            {phone}
          </Text>{' '}
          را وارد کنید.
        </Text>

        <TextInput
          label="کد بازیابی"
          placeholder="۱۲۳۴۵۶"
          inputMode="numeric"
          dir="ltr"
          styles={{ input: { textAlign: 'start' } }}
          required
          key={resetForm.key('code')}
          {...resetForm.getInputProps('code')}
        />

        <PasswordInput
          label="گذرواژه جدید"
          placeholder="حداقل ۸ نویسه"
          autoComplete="new-password"
          leftSection={<IconLock size={18} />}
          required
          key={resetForm.key('password')}
          {...resetForm.getInputProps('password')}
        />

        <PasswordInput
          label="تکرار گذرواژه جدید"
          placeholder="گذرواژه را دوباره وارد کنید"
          autoComplete="new-password"
          leftSection={<IconLock size={18} />}
          required
          key={resetForm.key('confirmPassword')}
          {...resetForm.getInputProps('confirmPassword')}
        />

        <Button type="submit" size="md" fullWidth loading={submitting}>
          تغییر گذرواژه
        </Button>

        <Group justify="center" gap={4}>
          <Text size="sm" c="dimmed">
            شماره اشتباه بود؟
          </Text>
          <Anchor
            component="button"
            type="button"
            size="sm"
            c="brand"
            onClick={() => {
              setStep('request');
              setError(null);
              setDevCode(null);
            }}
          >
            تغییر شماره
          </Anchor>
        </Group>
      </Stack>
    </form>
  );
}
