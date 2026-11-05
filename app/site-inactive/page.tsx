import type { Metadata } from 'next';
import { Button, Card, Center, Image, Stack, Text, Title } from '@mantine/core';
import { getLicense } from '@/lib/core-license';
import {
  blockCopy,
  blockForLicense,
  blockFromQuery,
  DB_PENDING_COPY,
  DIRECT_COPY,
  type SiteBlock,
} from '@/lib/site-block';
import { currentRequestDomain } from '@/lib/site-context';
import { siteDbFileExists } from '@/lib/site-db';

export const metadata: Metadata = {
  title: 'سایت موقتاً در دسترس نیست',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface SiteInactiveQuery {
  /** دلیل واقعی مسدودسازی — proxy آن را می‌فرستد (domain | db | license). */
  reason?: string;
  /** فقط برای reason=license؛ وضعیت لایسنس از پاسخ Core. */
  status?: string;
  /** "1" یعنی Core پاسخ سالم نداد (نه اینکه دامنه ثبت نشده باشد). */
  down?: string;
}

/**
 * صفحه تعلیق — فروشگاه وقتی لایسنس یا دیتابیس دامنه تأیید نشود به اینجا
 * می‌آید (بند ۲-۹).
 *
 * پیام از «دلیل واقعی» ساخته می‌شود، نه از حدس: تا وقتی دلیل از proxy نمی‌آمد،
 * دامنه‌ی ثبت‌شده‌ای که مثلاً دیتابیسش روی سرور نبود یا Host به اپ نمی‌رسید هم
 * پیام «این دامنه در سامانه ثبت نشده است» می‌دید. حالا هر علت متن خودش را دارد و
 * یک کد کوتاه لاتین هم برای پشتیبانی روی صفحه چاپ می‌شود.
 */
export default async function SiteInactivePage({
  searchParams,
}: {
  searchParams: Promise<SiteInactiveQuery>;
}) {
  const query = await searchParams;
  const domain = await currentRequestDomain();
  const license = await getLicense(domain ?? '');

  // ترتیب: دلیل صریح پراکسی → وضعیت لایسنس → لایسنس سالم یعنی گیت دیتابیس →
  // نبودِ لایسنس یعنی «قابل بررسی نبود» (نه «ثبت‌نشده»).
  const queryBlock = blockFromQuery(query);
  const licenseBlock = blockForLicense(license);
  // دلیل query فقط تا وقتی معتبر است که با وضعیت همین لحظه تناقض نداشته باشد؛
  // لینک کهنه/دستی نباید برای فروشگاه سالم پیام «ثبت‌نشده» یا «دیتابیس نیست»
  // بسازد.
  let trustedQuery = queryBlock;
  if (queryBlock && license?.ok === true && queryBlock.kind === 'license') {
    trustedQuery = null;
  } else if (queryBlock?.kind === 'db' && domain && siteDbFileExists(domain)) {
    trustedQuery = null;
  }
  const block: SiteBlock =
    trustedQuery ??
    licenseBlock ??
    (license ? { kind: 'db' } : { kind: 'license', status: 'unverified' });

  // pending در Core → پیام «در حال آماده‌سازی»؛ ورود مستقیم با لایسنس سالم →
  // پیام بی‌طرف (چیزی خراب نیست و نباید «دیتابیس نیست» ادعا شود).
  let copy = blockCopy(block);
  if (block.kind === 'db' && license?.ok && license.dbStatus === 'pending') {
    copy = DB_PENDING_COPY;
  } else if (!trustedQuery && license?.ok) {
    copy = DIRECT_COPY;
  }

  return (
    <Center mih="100vh" p="md" bg="#1B2A34">
      <Card className="login-card" w={480} p="xl" radius="lg" withBorder>
        <Stack gap="md" align="center">
          <Image src="/favicon.svg" alt="AlazCore" w={80} h={80} fit="contain" />
          <Title order={1} size="h3" ta="center" c="red.7">
            {copy.title}
          </Title>
          <Text size="sm" c="dimmed" ta="center" mih={40}>
            {copy.body}
          </Text>
          {copy.hint ? (
            <Text size="xs" c="dimmed" ta="center">
              {copy.hint}
            </Text>
          ) : null}
          <Text size="xs" c="dimmed" dir="ltr">
            {copy.code}
            {domain ? ` · ${domain}` : ''}
          </Text>
          {!trustedQuery && license?.ok ? (
            <Button component="a" href="/" variant="filled" color="brand" size="md">
              بازگشت به فروشگاه
            </Button>
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
