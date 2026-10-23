'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconAlertCircle, IconLock, IconPhone } from '@tabler/icons-react';
import { Alert, Anchor, Button, Divider, Modal, PasswordInput, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import OtpCodeStep from '@/components/auth/OtpCodeStep';
import SignupForm from '@/components/auth/SignupForm';
import PhoneInput from '@/components/ui/PhoneInput';
import { fromFaDigits } from '@/lib/format';
import { useShopCart } from './ShopCartProvider';

export type AuthModalMode = 'login' | 'signup' | 'forgot';

/** Iranian mobile: starts with 09, exactly 11 digits. */
const PHONE_PATTERN = /^09\d{9}$/;

const cleanPhone = (value: string): string => fromFaDigits(value).replace(/[\s()-]/g, '');

/**
 * The customer's sign-in / sign-up popup on the storefront. Staff keep their
 * own page at /login — this modal is phone-username only. The login step
 * carries two-step/OTP accounts through to the SMS-code step in place.
 */
export default function AuthModal({
  opened,
  onClose,
  mode,
  onModeChange,
  requireNationalId = false,
}: {
  opened: boolean;
  onClose: () => void;
  mode: AuthModalMode;
  onModeChange: (mode: AuthModalMode) => void;
  /** True when Shahkar matching is on — the signup step asks for کد ملی. */
  requireNationalId?: boolean;
}) {
  const router = useRouter();
  const { refreshPending } = useShopCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Two-step/OTP continuation, set after the password step succeeds. */
  const [pending, setPending] = useState<{ phone: string; ticket: string } | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { phone: '', password: '' },
    validate: {
      phone: (value) =>
        PHONE_PATTERN.test(cleanPhone(value))
          ? null
          : 'شماره موبایل باید با ۰۹ شروع شود و دقیقاً ۱۱ رقم باشد.',
      password: (value) => (value.length >= 8 ? null : 'گذرواژه باید حداقل ۸ نویسه باشد.'),
    },
  });

  function switchMode(next: AuthModalMode) {
    setError(null);
    setPending(null);
    setDevCode(null);
    onModeChange(next);
  }

  async function handleLogin(values: typeof form.values) {
    setSubmitting(true);
    setError(null);
    const phone = cleanPhone(values.phone);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password: values.password }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        otpRequired?: boolean;
        ticket?: string;
        devCode?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? 'ورود ناموفق بود.');
        return;
      }

      if (payload.otpRequired && payload.ticket) {
        // Two-step/OTP account: move on to the SMS-code step in place.
        setPending({ phone, ticket: payload.ticket });
        setDevCode(payload.devCode ?? null);
        return;
      }

      onClose();
      // Re-render the server pages so the header reflects the new session, and
      // pick up the account's unpaid order so the basket badge covers it.
      refreshPending();
      router.refresh();
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
        body: JSON.stringify({ phone: pending.phone, ticket: pending.ticket, code }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? 'کد وارد شده نادرست است یا منقضی شده است.');
        return;
      }

      onClose();
      refreshPending();
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.');
    } finally {
      setSubmitting(false);
    }
  }

  /** The SMS-code step of a two-step/OTP sign-in, rendered inside the modal. */
  const otpStep = pending ? (
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
  ) : null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        mode === 'signup'
          ? 'ثبت‌نام مشتری'
          : mode === 'forgot'
            ? 'بازیابی گذرواژه'
            : pending
              ? 'کد یکبار مصرف'
              : 'ورود مشتری'
      }
      centered
    >
      {mode === 'login' ? (
        pending ? (
          otpStep
        ) : (
          <form onSubmit={form.onSubmit(handleLogin)} noValidate>
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

              <PhoneInput
                label="شماره موبایل"
                placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                leftSection={<IconPhone size={18} />}
                required
                key={form.key('phone')}
                {...form.getInputProps('phone')}
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

              <Button type="submit" size="md" fullWidth loading={submitting}>
                ورود
              </Button>

              <Anchor
                component="button"
                type="button"
                size="sm"
                c="brand"
                ta="center"
                onClick={() => switchMode('forgot')}
              >
                گذرواژه را فراموش کرده‌اید؟
              </Anchor>

              <Divider
                labelPosition="center"
                label={
                  <Text size="xs" c="dimmed">
                    حساب ندارید؟
                  </Text>
                }
              />
              <Button variant="light" size="md" fullWidth onClick={() => switchMode('signup')}>
                ثبت‌نام با شماره موبایل
              </Button>
            </Stack>
          </form>
        )
      ) : mode === 'signup' ? (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            حساب ندارید؟ با شماره موبایل خود حساب بسازید.
          </Text>
          <SignupForm onDone={onClose} requireNationalId={requireNationalId} />
          <Anchor
            component="button"
            type="button"
            size="sm"
            c="brand"
            ta="center"
            onClick={() => switchMode('login')}
          >
            قبلاً ثبت‌نام کرده‌اید؟ ورود
          </Anchor>
        </Stack>
      ) : (
        <Stack gap="md">
          <ForgotPasswordForm onDone={() => switchMode('login')} />
          <Anchor
            component="button"
            type="button"
            size="sm"
            c="brand"
            ta="center"
            onClick={() => switchMode('login')}
          >
            بازگشت به ورود
          </Anchor>
        </Stack>
      )}
    </Modal>
  );
}
