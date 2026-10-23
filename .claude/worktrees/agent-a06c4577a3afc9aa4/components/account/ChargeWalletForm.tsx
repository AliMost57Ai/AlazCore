'use client';

import { useState } from 'react';
import { IconAlertCircle, IconCreditCard, IconWallet } from '@tabler/icons-react';
import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { fromFaDigits } from '@/lib/format';

/**
 * Online wallet top-up: the customer picks an amount, is sent to the ZarinPal
 * gateway, and the wallet is credited on the verified callback (recorded as a
 * pending → verified OnlinePaymentTransaction along the way).
 */
export default function ChargeWalletForm() {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCharge() {
    const value = Number(fromFaDigits(amount).replace(/[٬,٫.\s]/g, ''));
    if (!Number.isInteger(value) || value < 1000) {
      setError('مبلغ شارژ باید حداقل ۱٬۰۰۰ تومان باشد.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/wallet/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: value }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        redirectUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.redirectUrl) {
        setError(payload.error ?? 'شروع پرداخت ناموفق بود.');
        return;
      }

      window.location.href = payload.redirectUrl;
    } catch {
      setError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.');
      setLoading(false);
    }
  }

  return (
    <Stack gap="sm">
      <Group gap="sm" wrap="nowrap" align="flex-end">
        <TextInput
          label="مبلغ شارژ (تومان)"
          placeholder="مثلاً ۵۰۰٬۰۰۰"
          value={amount}
          onChange={(event) => setAmount(event.currentTarget.value)}
          style={{ flex: '1 1 200px' }}
          dir="ltr"
        />
        <Button leftSection={<IconCreditCard size={16} />} loading={loading} onClick={handleCharge}>
          پرداخت آنلاین
        </Button>
      </Group>
      {error ? (
        <Alert variant="light" color="red" icon={<IconAlertCircle size={16} />}>
          {error}
        </Alert>
      ) : null}
      <Group gap={6} c="dimmed">
        <IconWallet size={14} />
        <Text size="xs">
          مبلغ پس از پرداخت موفق به کیف پول شما افزوده می‌شود و سفارش‌ها از کیف پول پرداخت می‌شوند.
        </Text>
      </Group>
    </Stack>
  );
}
