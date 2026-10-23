'use client';

import { useEffect, useState } from 'react';
import { IconAlertCircle } from '@tabler/icons-react';
import { Alert, Button, Code, Stack, Text, TextInput } from '@mantine/core';
import { LOGIN_CODE_TTL_SECONDS } from '@/lib/constants';
import { fromFaDigits, toFaDigits } from '@/lib/format';

export interface OtpCodeStepProps {
  /** The phone number the code was sent to (shown back to the user). */
  phone: string;
  /** Parent's in-flight flag for the verify request. */
  submitting: boolean;
  /** Error text from the verify step, if any. */
  error: string | null;
  /** Development-only fallback code (shown when SMS delivery failed). */
  devCode?: string | null;
  /** Called with the 6-digit code the user typed. */
  onVerify: (code: string) => void;
  /** Back to the previous step (fix the phone / credentials). */
  onBack: () => void;
  backLabel?: string;
}

/**
 * The shared «enter the SMS code» step of every sign-in flow (classic
 * two-step, OTP-only page, storefront auth modal). The code is valid for
 * LOGIN_CODE_TTL_SECONDS — the live countdown disables submitting once it
 * runs out, and the server enforces the same deadline regardless.
 */
export default function OtpCodeStep({
  phone,
  submitting,
  error,
  devCode,
  onVerify,
  onBack,
  backLabel = 'بازگشت و اصلاح اطلاعات',
}: OtpCodeStepProps) {
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(LOGIN_CODE_TTL_SECONDS);
  const expired = secondsLeft <= 0;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const clock = toFaDigits(
    `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
  );

  function handleVerify() {
    if (code.length === 6) {
      onVerify(code);
    }
  }

  return (
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

      <Text size="sm" c="dimmed">
        کد ۶ رقمی ارسال‌شده به{' '}
        <Text component="span" fw={700} dir="ltr" inherit>
          {phone}
        </Text>{' '}
        را وارد کنید.
      </Text>

      {expired ? (
        <Text size="sm" c="red" fw={500}>
          مهلت وارد کردن کد به پایان رسید — بازگشت بزنید و دوباره کد دریافت کنید.
        </Text>
      ) : (
        <Text size="xs" c="dimmed">
          زمان باقی‌مانده:{' '}
          <Text component="span" fw={700} dir="ltr" inherit>
            {clock}
          </Text>
        </Text>
      )}

      {devCode ? (
        <Alert variant="light" color="blue" icon={<IconAlertCircle size={18} />}>
          کد آزمایشی (ارسال پیامک پیکربندی نشده): <Code dir="ltr">{devCode}</Code>
        </Alert>
      ) : null}

      <TextInput
        label="کد یکبار مصرف"
        description="کد ۶ رقمی ارسال‌شده به موبایل شما"
        placeholder="------"
        dir="ltr"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(event) =>
          setCode(fromFaDigits(event.currentTarget.value).replace(/\D/g, '').slice(0, 6))
        }
        aria-label="کد یکبار مصرف"
        required
      />

      <Button
        type="button"
        size="md"
        fullWidth
        loading={submitting}
        disabled={expired || code.length !== 6}
        onClick={handleVerify}
      >
        تأیید و ورود
      </Button>

      <Button type="button" variant="subtle" size="sm" onClick={onBack}>
        {backLabel}
      </Button>
    </Stack>
  );
}
