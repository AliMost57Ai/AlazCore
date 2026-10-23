import { Suspense } from 'react';
import type { Metadata } from 'next';
import { IconBolt, IconMessage2, IconShieldCheck } from '@tabler/icons-react';
import { Card, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import OtpLoginForm from '@/components/auth/OtpLoginForm';
import DirectionControl, { ColorSchemeControl } from '@/components/layout/HeaderControls';
import classes from '../login/page.module.css';

export const metadata: Metadata = {
  title: 'ورود با رمز یکبار مصرف',
  description: 'بدون گذرواژه، فقط با کد یکبارمصرف پیامکی وارد شوید.',
};

const HIGHLIGHTS = [
  { icon: IconMessage2, title: 'بدون گذرواژه', text: 'فقط شماره موبایل و رمز یکبار مصرف.' },
  { icon: IconShieldCheck, title: 'کد یکبار مصرف', text: 'کد ۲ دقیقه اعتبار دارد.' },
  { icon: IconBolt, title: 'سریع', text: 'دو مرحله ساده تا ورود.' },
];

/** The OTP-only sign-in page — accounts whose method is «رمز یکبار مصرف». */
export default function LoginOtpPage() {
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
            ورود فقط با رمز یکبار مصرف
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
              ورود با رمز یکبار مصرف
            </Title>
            <Text c="dimmed" size="sm" mb="lg">
              شماره موبایل خود را وارد کنید تا کد ورود برایتان پیامک شود.
            </Text>

            {/* OtpLoginForm reads `?next=`, so it needs a Suspense boundary. */}
            <Suspense fallback={<Skeleton height={320} radius="md" />}>
              <OtpLoginForm />
            </Suspense>
          </Card>
        </div>
      </div>
    </main>
  );
}
