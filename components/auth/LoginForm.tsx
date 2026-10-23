'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconAlertCircle, IconLock, IconMail } from '@tabler/icons-react';
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Code,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import OtpCodeStep from '@/components/auth/OtpCodeStep';
import { DEMO_CREDENTIALS } from '@/lib/constants';
import { fromFaDigits } from '@/lib/format';

/** Iranian mobile: starts with 09, exactly 11 digits. */
const PHONE_PATTERN = /^09\d{9}$/;

/** Only relative, same-origin paths — never let `?next=` become an open redirect. */
function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) {
    return '/dashboard';
  }
  return target;
}

interface LoginResponse {
  user?: { role?: string };
  /** Set when the account needs the SMS-code step (two-step / OTP login). */
  otpRequired?: boolean;
  ticket?: string;
  devCode?: string;
  devNote?: string;
  error?: string;
}

export interface LoginFormProps {
  /**
   * Offer an in-place switch to the OTP-only form (used by /login under a
   * forced OTP policy) instead of linking out to /login-otp.
   */
  onSwitchToOtp?: () => void;
}

export default function LoginForm({ onSwitchToOtp }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  /** Two-step/OTP continuation state, set after the first step succeeds. */
  const [pending, setPending] = useState<{ phone: string; ticket: string } | null>(null);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { identifier: '', password: '', remember: true },
    validate: {
      // Staff sign in with email, customers with their phone as username.
      identifier: (value) => {
        const trimmed = value.trim();
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
        const isPhone = PHONE_PATTERN.test(fromFaDigits(trimmed));
        return isEmail || isPhone ? null : 'ایمیل یا شماره موبایل (۰۹…) معتبر نیست.';
      },
      password: (value) => (value.length >= 8 ? null : 'گذرواژه باید حداقل ۸ نویسه باشد.'),
    },
  });

  function completeLogin(payload: LoginResponse) {
    // Customers land on the storefront; staff go where they were headed.
    const fallback = payload.user?.role === 'customer' ? '/' : '/dashboard';
    const next = safeRedirect(searchParams.get('next'));
    // refresh() so the server layouts re-read the new session cookie.
    router.replace(payload.user?.role === 'customer' ? fallback : next);
    router.refresh();
  }

  async function handleSubmit(values: typeof form.values) {
    setSubmitting(true);
    setError(null);

    const trimmed = values.identifier.trim();
    const isPhone = PHONE_PATTERN.test(fromFaDigits(trimmed));
    const phone = isPhone ? fromFaDigits(trimmed).replace(/[\s()-]/g, '') : null;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [isPhone ? 'phone' : 'email']: isPhone ? phone : trimmed,
          password: values.password,
          remember: values.remember,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as LoginResponse;

      if (!response.ok) {
        setError(payload.error ?? 'ورود ناموفق بود. لطفاً دوباره تلاش کنید.');
        return;
      }

      if (payload.otpRequired && payload.ticket) {
        // Two-step/OTP account: the SMS code is on its way — show the code form.
        setPending({ phone: phone ?? '', ticket: payload.ticket });
        setDevCode(payload.devCode ?? null);
        return;
      }

      completeLogin(payload);
    } catch {
      setError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(code: string) {
    if (!pending) {
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: pending.phone,
          ticket: pending.ticket,
          code,
          remember: form.getValues().remember,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as LoginResponse;

      if (!response.ok) {
        setError(payload.error ?? 'کد وارد شده نادرست است یا منقضی شده است.');
        return;
      }

      completeLogin(payload);
    } catch {
      setError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.');
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Step 2: the SMS-code form of a two-step/OTP sign-in ----------------
  if (pending) {
    return (
      <OtpCodeStep
        phone={pending.phone}
        submitting={submitting}
        error={error}
        devCode={devCode}
        onVerify={(code) => void handleVerify(code)}
        onBack={() => {
          setPending(null);
          setDevCode(null);
          setError(null);
        }}
      />
    );
  }

  // ---- Step 1: identifier + password ---------------------------------------
  return (
    <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <Stack gap="md">
        {error ? (
          <Alert
            variant="light"
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="ورود انجام نشد"
          >
            {error}
          </Alert>
        ) : null}

        <TextInput
          label="ایمیل یا شماره موبایل"
          placeholder="you@example.com یا ۰۹۱۲۱۲۳۴۵۶۷"
          autoComplete="username"
          leftSection={<IconMail size={18} />}
          // Latin-script field inside an RTL page: force LTR so the caret and
          // the @ sit where the user expects.
          dir="ltr"
          styles={{ input: { textAlign: 'start' } }}
          required
          key={form.key('identifier')}
          {...form.getInputProps('identifier')}
        />

        <PasswordInput
          label="گذرواژه"
          placeholder="گذرواژه خود را وارد کنید"
          autoComplete="current-password"
          leftSection={<IconLock size={18} />}
          required
          key={form.key('password')}
          {...form.getInputProps('password')}
        />

        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Checkbox
            label="مرا به خاطر بسپار"
            key={form.key('remember')}
            {...form.getInputProps('remember', { type: 'checkbox' })}
          />
          <Anchor href="/forgot" size="sm" c="brand" style={{ whiteSpace: 'nowrap' }}>
            گذرواژه را فراموش کرده‌اید؟
          </Anchor>
        </Group>

        <Button type="submit" size="md" fullWidth loading={submitting}>
          ورود به حساب
        </Button>

        {onSwitchToOtp ? (
          <Anchor
            component="button"
            type="button"
            size="sm"
            c="brand"
            ta="center"
            onClick={onSwitchToOtp}
          >
            ورود فقط با رمز یکبار مصرف (بدون گذرواژه)
          </Anchor>
        ) : (
          <Anchor href="/login-otp" size="sm" c="brand" ta="center" style={{ display: 'block' }}>
            ورود فقط با رمز یکبار مصرف (بدون گذرواژه)
          </Anchor>
        )}

        <Text size="sm" c="dimmed" ta="center">
          حساب ندارید؟{' '}
          <Anchor href="/signup" c="brand">
            ثبت‌نام مشتری
          </Anchor>
        </Text>

        <Text size="xs" c="dimmed" ta="center">
          حساب آزمایشی مدیر: <Code dir="ltr">{DEMO_CREDENTIALS.email}</Code> /{' '}
          <Code dir="ltr">{DEMO_CREDENTIALS.password}</Code>
        </Text>
      </Stack>
    </form>
  );
}
