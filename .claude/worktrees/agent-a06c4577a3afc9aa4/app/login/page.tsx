import { Suspense } from 'react';
import type { Metadata } from 'next';
import { IconBolt, IconChartBar, IconDeviceMobile, IconShieldLock } from '@tabler/icons-react';
import { Card, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import LoginSwitcher from '@/components/auth/LoginSwitcher';
import DirectionControl, { ColorSchemeControl } from '@/components/layout/HeaderControls';
import { getAppSettings } from '@/lib/settings';
import classes from './page.module.css';

export const metadata: Metadata = {
  title: 'ورود',
  description: 'برای دسترسی به پنل مدیریت وارد حساب خود شوید.',
};

const HIGHLIGHTS = [
  { icon: IconChartBar, title: 'گزارش‌های زنده', text: 'درآمد، سفارش‌ها و مشتریان در یک نگاه.' },
  {
    icon: IconDeviceMobile,
    title: 'واکنش‌گرا',
    text: 'از موبایل تا نمایشگر بزرگ، بدون افت تجربه.',
  },
  { icon: IconShieldLock, title: 'دسترسی ایمن', text: 'نشست امضاشده با کوکی httpOnly.' },
];

export default async function LoginPage() {
  // A forced OTP policy flips the default form to phone + code; staff (and
  // anyone preferring a password) can still switch to the classic form.
  const settings = await getAppSettings();

  return (
    <main className={classes.page}>
      {/* Toggles live outside the card so the visitor can set direction and
          theme before signing in. */}
      <Group className={classes.controls} gap="xs">
        <DirectionControl />
        <ColorSchemeControl />
      </Group>

      <div className={classes.layout}>
        <section className={classes.aside} aria-hidden="true">
          <Group gap={10} mb="xl">
            <span className={classes.mark}>
              <IconBolt size={20} stroke={2.2} />
            </span>
            <Text fw={700} fz="lg" c="white">
              پنل مدیریت
            </Text>
          </Group>

          <Title order={2} c="white" fz={{ base: 'h3', lg: 'h2' }} lh={1.4}>
            همه‌چیز درباره کسب‌وکار شما، در یک داشبورد
          </Title>

          <Stack gap="lg" mt="xl">
            {HIGHLIGHTS.map((item) => (
              <Group key={item.title} gap="sm" wrap="nowrap" align="flex-start">
                <span className={classes.highlightIcon}>
                  <item.icon size={18} stroke={1.8} />
                </span>
                <div>
                  <Text fw={600} c="white" size="sm">
                    {item.title}
                  </Text>
                  <Text size="sm" className={classes.highlightText}>
                    {item.text}
                  </Text>
                </div>
              </Group>
            ))}
          </Stack>
        </section>

        <div className={classes.formSide}>
          <Card withBorder={false} shadow="none" padding={0} className={classes.formCard}>
            <Group gap={10} mb="lg" hiddenFrom="md">
              <span className={`${classes.mark} ${classes.markCompact}`}>
                <IconBolt size={18} stroke={2.2} />
              </span>
              <Text fw={700} fz="lg">
                پنل مدیریت
              </Text>
            </Group>

            <Title order={1} fz="h2" mb={6}>
              ورود به حساب
            </Title>
            <Text c="dimmed" size="sm" mb="lg">
              برای دیدن داشبورد، ابتدا وارد شوید.
            </Text>

            {/* The switcher reads `?next=`, so it needs a Suspense boundary. */}
            <Suspense fallback={<Skeleton height={320} radius="md" />}>
              <LoginSwitcher initialMode={settings.loginPolicy === 'otp' ? 'otp' : 'classic'} />
            </Suspense>
          </Card>
        </div>
      </div>
    </main>
  );
}
