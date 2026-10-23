import type { Metadata } from 'next';
import { IconBolt, IconPhone, IconShieldCheck, IconShoppingCart } from '@tabler/icons-react';
import { Card, Group, Stack, Text, Title } from '@mantine/core';
import SignupForm from '@/components/auth/SignupForm';
import DirectionControl, { ColorSchemeControl } from '@/components/layout/HeaderControls';
import { getAppSettings } from '@/lib/settings';
import classes from '../login/page.module.css';

export const metadata: Metadata = {
  title: 'ثبت‌نام',
  description: 'با شماره موبایل خود حساب بسازید و از فروشگاه خرید کنید.',
};

const HIGHLIGHTS = [
  { icon: IconPhone, title: 'ثبت‌نام با موبایل', text: 'شماره‌تان نام کاربری شماست.' },
  { icon: IconShoppingCart, title: 'خرید آسان', text: 'محصولات را ببینید و انتخاب کنید.' },
  { icon: IconShieldCheck, title: 'امن', text: 'گذرواژه با PBKDF2 نگهداری می‌شود.' },
];

export default async function SignupPage() {
  // Shahkar (تنظیمات → شاهکار) makes the national ID a required, verified field.
  const settings = await getAppSettings();

  return (
    <main className={classes.page}>
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
              فروشگاه
            </Text>
          </Group>

          <Title order={2} c="white" fz={{ base: 'h3', lg: 'h2' }} lh={1.4}>
            چند ثانیه تا حساب مشتری
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
                فروشگاه
              </Text>
            </Group>

            <Title order={1} fz="h2" mb={6}>
              ثبت‌نام مشتری
            </Title>
            <Text c="dimmed" size="sm" mb="lg">
              با شماره موبایل و یک گذرواژه حساب خود را بسازید.
            </Text>

            <SignupForm requireNationalId={settings.shahkarEnabled} />
          </Card>
        </div>
      </div>
    </main>
  );
}
