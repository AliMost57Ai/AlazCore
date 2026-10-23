'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconAlertCircle } from '@tabler/icons-react';
import { Alert, Anchor, Button, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import OtpCodeStep from '@/components/auth/OtpCodeStep';
import PhoneInput from '@/components/ui/PhoneInput';
import { fromFaDigits } from '@/lib/format';

/** Iranian mobile: starts with 09, exactly 11 digits. */
const PHONE_PATTERN = /^09\d{9}$/;

function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) {
    return '/dashboard';
  }
  return target;
}

interface OtpStartResponse {
  ok?: boolean;
  ticket?: string;
  devCode?: string;
  devNote?: string;
  error?: string;
}

export interface OtpLoginFormProps {
  /**
   * Offer an in-place switch back to the password form (used by /login under
   * a forced OTP policy, where staff still need their email + password).
   */
  onSwitchToPassword?: () => void;
}

/**
 * The OTP-only sign-in (روش ورود «رمز یکبار مصرف» in the customer's profile, or
 * the admin's forced site-wide policy): phone number → SMS code → session.
 * Accounts whose method is password/two-step are turned away to the classic
 * login form.
 */
export default function OtpLoginForm({ onSwitchToPassword }: OtpLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ phone: string; ticket: string } | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { phone: '' },
    validate: {
      phone: (value) =>
        PHONE_PATTERN.test(fromFaDigits(value).replace(/[\s()-]/g, ''))
          ? null
          : 'شماره موبایل باید با ۰۹ شروع شود و دقیقاً ۱۱ رقم باشد.',
    },
  });

  async function handleStart(values: typeof form.values) {
    setSubmitting(true);
    setError(null);
    const phone = fromFaDigits(values.phone).replace(/[\s()-]/g, '');

    try {
      const response = await fetch('/api/auth/login/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const payload = (await response.json().catch(() => ({}))) as OtpStartResponse;

      if (!response.ok || !payload.ticket) {
        setError(payload.error ?? 'ارسال کد ناموفق بود. لطفاً دوباره تلاش کنید.');
        return;
      }

      setPending({ phone, ticket: payload.ticket });
      setDevCode(payload.devCode ?? null);
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
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        user?: { role?: string };
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? 'کد وارد شده نادرست است یا منقضی شده است.');
        return;
      }

      router.replace(
        payload.user?.role === 'customer' ? '/' : safeRedirect(searchParams.get('next'))
      );
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.');
    } finally {
      setSubmitting(false);
    }
  }

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
        backLabel="بازگشت و اصلاح شماره"
      />
    );
  }

  return (
    <form onSubmit={form.onSubmit(handleStart)} noValidate>
      <Stack gap="md">
        {error ? (
          <Alert
            variant="light"
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="ارسال کد ناموفق بود"
          >
            {error}
          </Alert>
        ) : null}

        <PhoneInput
          label="شماره موبایل"
          description="شماره‌ای که با آن ثبت‌نام کرده‌اید — کد ورود به همین شماره پیامک می‌شود."
          placeholder="۰۹۱۲۱۲۳۴۵۶۷"
          required
          key={form.key('phone')}
          {...form.getInputProps('phone')}
        />

        <Button type="submit" size="md" fullWidth loading={submitting}>
          دریافت کد ورود
        </Button>

        <Text size="sm" c="dimmed" ta="center">
          این روش فقط برای حساب‌هایی که «ورود با رمز یکبار مصرف» را انتخاب کرده‌اند فعال است.{' '}
          {onSwitchToPassword ? (
            <Anchor component="button" type="button" c="brand" onClick={onSwitchToPassword}>
              ورود با گذرواژه
            </Anchor>
          ) : (
            <Anchor href="/login" c="brand">
              ورود با گذرواژه
            </Anchor>
          )}
        </Text>
      </Stack>
    </form>
  );
}
