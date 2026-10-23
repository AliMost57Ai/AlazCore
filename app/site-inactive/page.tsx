import type { Metadata } from 'next';
import { Button, Card, Center, Image, Stack, Text, Title } from '@mantine/core';
import { getLicense } from '@/lib/core-license';
import { currentRequestDomain } from '@/lib/site-context';

export const metadata: Metadata = {
  title: 'سایت موقتاً در دسترس نیست',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const REASONS: Record<string, { title: string; body: string }> = {
  inactive: {
    title: 'این فروشگاه غیرفعال شده است',
    body: 'سرویس این فروشگاه توسط مدیریت سامانه غیرفعال شده است. برای پیگیری با پشتیبانی AlazCore تماس بگیرید.',
  },
  suspended: {
    title: 'این فروشگاه موقتاً تعلیق شده است',
    body: 'این سایت توسط پشتیبانی تعلیق شده است. معمولاً دلیل آن در تیکت‌های پنل مالک ثبت شده است.',
  },
  expired: {
    title: 'اعتبار پلن این فروشگاه به پایان رسیده است',
    body: 'برای فعال‌سازی مجدد سایت، پلن خود را از پنل مدیریت AlazCore تمدید کنید.',
  },
  unknown: {
    title: 'این دامنه در سامانه ثبت نشده است',
    body: 'دامنه‌ی شما مجوز استفاده از فروشگاه‌ساز AlazCore را ندارد. برای ثبت، با پشتیبانی در تماس باشید.',
  },
};

/** صفحه تعلیق — فروشگاه وقتی لایسنسش رد شود به اینجا هدایت می‌شود (بند ۲-۹). */
export default async function SiteInactivePage() {
  const domain = await currentRequestDomain();
  const license = await getLicense(domain ?? '');
  // Core سالم پاسخ نداد ≠ دامنه ثبت‌نشده — پیام مخصوص «سرویس قطع» را نشان بده.
  const reason = license?.serviceDown
    ? {
        title: 'سرویس موقتاً در دسترس نیست',
        body: 'در این لحظه امکان بررسی اعتبار فروشگاه توسط سامانه AlazCore وجود ندارد. چند لحظه بعد دوباره تلاش کنید؛ اگر ادامه داشت با پشتیبانی تماس بگیرید.',
      }
    : license?.ok && license.dbStatus === 'pending'
      ? {
          title: 'فروشگاه در حال آماده‌سازی است',
          body: 'دیتابیس اختصاصی این سایت در حال ساخت است. چند دقیقه بعد دوباره تلاش کنید؛ اگر ادامه داشت با پشتیبانی تماس بگیرید.',
        }
      : (REASONS[license?.status ?? 'unknown'] ?? REASONS.unknown);

  return (
    <Center mih="100vh" p="md" bg="#1B2A34">
      <Card className="login-card" w={480} p="xl" radius="lg" withBorder>
        <Stack gap="md" align="center">
          <Image src="/favicon.svg" alt="AlazCore" w={80} h={80} fit="contain" />
          <Title order={1} size="h3" ta="center" c="red.7">
            {reason.title}
          </Title>
          <Text size="sm" c="dimmed" ta="center" mih={40}>
            {reason.body}
          </Text>
          {domain ? (
            <Text size="xs" c="dimmed" dir="ltr">
              {domain}
            </Text>
          ) : null}
          <Button
            component="a"
            href="mailto:support@alazcore.ir"
            variant="light"
            color="brand"
            size="md"
          >
            تماس با پشتیبانی AlazCore
          </Button>
        </Stack>
      </Card>
    </Center>
  );
}
