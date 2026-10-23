'use client';

import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
  Alert,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { IconKey, IconRefresh } from '@tabler/icons-react';

export default function SettingsClient({
  apiKey,
  apiKeyFromEnv,
}: {
  apiKey: string;
  apiKeyFromEnv: boolean;
}) {
  const [key, setKey] = useState(apiKey);
  const [busy, setBusy] = useState(false);

  async function regenerate() {
    if (!window.confirm('کلید جدید تولید شود؟ همه فروشگاه‌های متصل با کلید قبلی 401 می‌گیرند.')) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerateApiKey' }),
      });
      const data = (await response.json()) as { apiKey?: string; error?: string };
      if (!response.ok || !data.apiKey) {
        notifications.show({ message: data.error ?? 'تولید کلید ناموفق بود.', color: 'crimson' });
        return;
      }
      setKey(data.apiKey);
      notifications.show({ message: 'کلید API بازتولید شد.', color: 'brand' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="lg">
      <Title order={2}>تنظیمات سامانه</Title>

      <Card padding="lg" withBorder>
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <Text fw={700}>کلید API اعتبارسنجی لایسنس</Text>
            <IconKey size={18} opacity={0.6} />
          </Group>
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            loading={busy}
            onClick={regenerate}
            disabled={apiKeyFromEnv}
          >
            بازتولید کلید
          </Button>
        </Group>

        {apiKeyFromEnv ? (
          <Alert mb="sm" variant="light" color="blue">
            کلید از متغیر محیطی CORE_API_KEY تزریق شده و از همین‌جا قابل تغییر نیست.
          </Alert>
        ) : null}

        <Group gap="sm">
          <Code flex={1} style={{ overflowX: 'auto' }} dir="ltr">
            {key || '— کلیدی تولید نشده —'}
          </Code>
          <CopyButton value={key}>
            {({ copied, copy }) => (
              <Button size="sm" variant="subtle" onClick={copy}>
                {copied ? 'کپی شد' : 'کپی'}
              </Button>
            )}
          </CopyButton>
        </Group>
      </Card>

      <Card padding="lg" withBorder>
        <Title order={4} mb="sm">
          راهنمای اتصال فروشگاه به Core
        </Title>
        <Text size="sm" c="dimmed" mb="sm">
          در پنل فروشگاه (فایل .env فروشگاه) این دو متغیر را تنظیم کنید؛ فروشگاه پیش از لود شدن
          اعتبارش را با این سرویس چک می‌کند و منوها/درگاه‌ها/تم طبق تعریف این پنل لود می‌شوند:
        </Text>
        <Textarea
          readOnly
          autosize
          minRows={3}
          dir="ltr"
          styles={{ input: { fontFamily: 'monospace', fontSize: 13 } }}
          value={`CORE_API_URL=http://<آدرس-این-پنل>:3100
CORE_API_KEY=${key || '<کلید-بالا>'}`}
        />
        <Text size="sm" mt="sm">
          نمونه فراخوانی مستقیم (برای تست):
        </Text>
        <Textarea
          readOnly
          autosize
          minRows={2}
          dir="ltr"
          styles={{ input: { fontFamily: 'monospace', fontSize: 13 } }}
          value={`curl -X POST http://<آدرس>:3100/api/validate \\
  -H "x-core-key: ${key || '<کلید>'}" -H "Content-Type: application/json" \\
  -d '{"domain":"joghd.ir"}'`}
        />
      </Card>
    </Stack>
  );
}
