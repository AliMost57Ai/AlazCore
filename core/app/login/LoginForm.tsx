'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Center,
  Divider,
  Image,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconLock, IconMail } from '@tabler/icons-react';

/**
 * ورود پنل Core — عمداً متفاوت از لاگین فروشگاه: تمام‌صفحه روی پس‌زمینه
 * سرمه‌ای لوگو (#1B2A34) با هاله شعله‌ای برند و لوگوی کامل؛ بدون کارت روشن
 * وسط‌چینِ لاگین مالک/پرسنل فروشگاه. تم روشن/تیره هم اینجا معنا ندارد —
 * هویت پنل همیشه تیره است.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? 'ورود ناموفق بود.');
        return;
      }
      const next = searchParams.get('next');
      router.replace(next && next.startsWith('/panel') ? next : '/panel');
      router.refresh();
    } catch {
      setError('خطای شبکه — دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      mih="100vh"
      style={{
        background:
          'radial-gradient(1200px 600px at 85% -10%, rgba(251,116,1,0.18), transparent 60%), radial-gradient(900px 500px at 0% 110%, rgba(124,0,12,0.25), transparent 55%), #1B2A34',
      }}
    >
      <Center mih="100vh" px="md">
        <Stack gap="xl" align="center" w={420}>
          {/* لوگوی کامل برند — نشانگر این که این پنل، سامانه مرکزی است نه فروشگاه */}
          <Image
            src="/logo-full.png"
            alt="AlazCore"
            w={280}
            fit="contain"
            style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,.45))' }}
          />

          <Stack gap={4} align="center">
            <Title order={1} size="h2" c="white" ta="center">
              سامانه مدیریت مرکزی
            </Title>
            <Text size="sm" c="#9DB1B8" ta="center">
              پنل سوپرادمین فروشگاه‌ساز AlazCore — فقط برای مدیران سامانه
            </Text>
          </Stack>

          <Box
            w="100%"
            p="xl"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 20,
              backdropFilter: 'blur(8px)',
            }}
          >
            <Stack gap="lg">
              <Divider
                label="احراز هویت مدیر"
                labelPosition="center"
                c="#9DB1B8"
                style={{ '--divider-color': 'rgba(255,255,255,0.12)' }}
              />

              {error ? (
                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                  {error}
                </Alert>
              ) : null}

              <form onSubmit={submit}>
                <Stack gap="sm">
                  <TextInput
                    label="ایمیل مدیر"
                    placeholder="admin@alazcore.ir"
                    leftSection={<IconMail size={16} />}
                    value={email}
                    onChange={(e) => setEmail(e.currentTarget.value)}
                    required
                    autoComplete="username"
                    styles={{
                      label: { color: '#DDE6E9' },
                      input: { background: 'rgba(0,0,0,0.25)', borderColor: 'rgba(255,255,255,0.15)', color: 'white' },
                    }}
                  />
                  <PasswordInput
                    label="رمز عبور"
                    leftSection={<IconLock size={16} />}
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    required
                    autoComplete="current-password"
                    styles={{
                      label: { color: '#DDE6E9' },
                      input: { background: 'rgba(0,0,0,0.25)', borderColor: 'rgba(255,255,255,0.15)', color: 'white' },
                    }}
                  />
                  <Button
                    type="submit"
                    loading={loading}
                    size="md"
                    fullWidth
                    mt="xs"
                    style={{ background: 'var(--core-flame)', border: 'none' }}
                  >
                    ورود به سامانه Core
                  </Button>
                </Stack>
              </form>
            </Stack>
          </Box>

          <Text size="xs" c="#9DB1B8" ta="center">
            حساب پیش‌فرض نصب: admin@alazcore.ir / admin1234 — پس از اولین ورود رمز را عوض کنید.
          </Text>
        </Stack>
      </Center>
    </Box>
  );
}
