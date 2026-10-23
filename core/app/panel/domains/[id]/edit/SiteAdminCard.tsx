'use client';

/**
 * کارت «اطلاعات ورود فروشگاه» در صفحه‌ی ویرایش دامنه — اعتبارنامه ادمینِ
 * همان سایت را نشان می‌دهد: نام کاربری (admin@{دامنه})، رمز پیش‌فرض ثابت
 * (admin1234 — قرارداد محصول)، وضعیت رمز (پیش‌فرض یا تغییرشده) و دکمه‌ی
 * بازنشانی به پیش‌فرض. داده از GET/POST /api/domains/{id}/site-admin می‌آید
 * (پروکسی به API فروشگاه با x-core-key — کور دیتابیس سایت را مستقیم نمی‌خواند).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  LoadingOverlay,
  Modal,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconKey, IconRefresh, IconShieldCheck, IconAlertTriangle } from '@tabler/icons-react';

const DEFAULT_PASSWORD = 'admin1234';

interface SiteAdminInfo {
  email: string;
  isDefaultPassword: boolean;
}

interface SiteAdminCardProps {
  domainId: string;
  dbStatus: string;
}

export default function SiteAdminCard({ domainId, dbStatus }: SiteAdminCardProps) {
  const [info, setInfo] = useState<SiteAdminInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/domains/${domainId}/site-admin`);
      const body = (await response.json()) as SiteAdminInfo & { error?: string };
      if (!response.ok) {
        setLoadError(body.error ?? 'دریافت اطلاعات ممکن نشد.');
        setInfo(null);
      } else {
        setInfo({ email: body.email, isDefaultPassword: body.isDefaultPassword });
      }
    } catch {
      setLoadError('ارتباط با سرور ممکن نشد.');
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [domainId]);

  useEffect(() => {
    if (dbStatus === 'ready') {
      void load();
    } else {
      setLoading(false);
    }
  }, [dbStatus, load]);

  const resetPassword = useCallback(async () => {
    setResetting(true);
    try {
      const response = await fetch(`/api/domains/${domainId}/site-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      const body = (await response.json()) as SiteAdminInfo & { error?: string };
      if (!response.ok) {
        notifications.show({ color: 'red', message: body.error ?? 'بازنشانی ممکن نشد.' });
      } else {
        setInfo({ email: body.email, isDefaultPassword: body.isDefaultPassword });
        notifications.show({ color: 'teal', message: 'رمز ادمین به پیش‌فرض بازگشت (admin1234).' });
      }
    } catch {
      notifications.show({ color: 'red', message: 'ارتباط با سرور ممکن نشد.' });
    } finally {
      setResetting(false);
      setResetOpen(false);
    }
  }, [domainId]);

  return (
    <Card padding="lg" withBorder mt="md">
      <LoadingOverlay visible={loading} />
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <IconKey size={18} />
            <Title order={3} size="h4">
              اطلاعات ورود فروشگاه
            </Title>
          </Group>
          <Badge color={dbStatus === 'ready' ? 'teal' : 'orange'}>
            {dbStatus === 'ready' ? 'دیتابیس آماده' : 'دیتابیس در انتظار provision'}
          </Badge>
        </Group>

        {dbStatus !== 'ready' ? (
          <Alert icon={<IconAlertTriangle size={16} />} color="orange">
            دیتابیس این دامنه هنوز provision نشده — بعد از اتمام provisioning اطلاعات ورود
            اینجا نمایش داده می‌شود.
          </Alert>
        ) : loadError ? (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="red"
            title="خطا در دریافت اطلاعات"
          >
            {loadError}
          </Alert>
        ) : info ? (
          <>
            <Group gap="sm" align="center" wrap="nowrap">
              <Text size="sm" fw={500} w={110} visibleFrom="xs">
                نام کاربری:
              </Text>
              <Code dir="ltr" style={{ fontSize: 14 }}>
                {info.email}
              </Code>
              <CopyButton value={info.email}>
                {({ copied, copy }) => (
                  <Button size="compact-xs" variant="subtle" onClick={copy}>
                    {copied ? 'کپی شد' : 'کپی'}
                  </Button>
                )}
              </CopyButton>
            </Group>
            <Group gap="sm" align="center" wrap="nowrap">
              <Text size="sm" fw={500} w={110} visibleFrom="xs">
                رمز عبور:
              </Text>
              {info.isDefaultPassword ? (
                <>
                  <Code dir="ltr" style={{ fontSize: 14 }}>
                    {DEFAULT_PASSWORD}
                  </Code>
                  <CopyButton value={DEFAULT_PASSWORD}>
                    {({ copied, copy }) => (
                      <Button size="compact-xs" variant="subtle" onClick={copy}>
                        {copied ? 'کپی شد' : 'کپی'}
                      </Button>
                    )}
                  </CopyButton>
                </>
              ) : (
                <Group gap="xs">
                  <IconShieldCheck size={16} color="teal" />
                  <Text size="sm" c="dimmed">
                    رمز تغییر کرده است — مقدار فعلی در کور محفوظ نیست.
                  </Text>
                </Group>
              )}
            </Group>
            <Alert color="blue" variant="light">
              رمز پیش‌فرض فقط برای اولین ورود است — مالک بعد از ورود باید آن را تغییر دهد. با
              بازنشانی، رمز فعلی حذف و به پیش‌فرض برمی‌گردد.
            </Alert>
            <Group justify="flex-end">
              <Button
                variant="light"
                color="orange"
                leftSection={<IconRefresh size={16} />}
                loading={resetting}
                onClick={() => setResetOpen(true)}
              >
                بازنشانی رمز به پیش‌فرض
              </Button>
            </Group>
          </>
        ) : null}
      </Stack>

      <Modal
        opened={resetOpen}
        onClose={() => setResetOpen(false)}
        title="بازنشانی رمز ادمین"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            رمز فعلی <Code dir="ltr">{info?.email}</Code> حذف و به پیش‌فرض{' '}
            <Code dir="ltr">{DEFAULT_PASSWORD}</Code> برمی‌گردد. مطمئنید؟
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setResetOpen(false)}>
              انصراف
            </Button>
            <Button color="orange" loading={resetting} onClick={() => void resetPassword()}>
              بازنشانی کن
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}
