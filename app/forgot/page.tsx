import type { Metadata } from 'next';
import { IconBolt } from '@tabler/icons-react';
import { Card, Group, Text, Title } from '@mantine/core';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import DirectionControl, { ColorSchemeControl } from '@/components/layout/HeaderControls';
import classes from '../login/page.module.css';

export const metadata: Metadata = {
  title: 'بازیابی گذرواژه',
  description: 'با شماره موبایل خود گذرواژه را بازنشانی کنید.',
};

export default function ForgotPasswordPage() {
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
            گذرواژه را فراموش کرده‌اید؟
          </Title>
          <Text size="sm" className={classes.highlightText} mt="sm">
            نگران نباشید — با شماره موبایلی که ثبت کرده‌اید، در دو مرحله گذرواژه جدید تعیین کنید.
          </Text>
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
              بازیابی گذرواژه
            </Title>
            <Text c="dimmed" size="sm" mb="lg">
              شماره موبایل حساب خود را وارد کنید تا کد بازیابی دریافت کنید.
            </Text>

            <ForgotPasswordForm />
          </Card>
        </div>
      </div>
    </main>
  );
}
