import type { Metadata } from 'next';
import Link from 'next/link';
import { IconArrowBackUp, IconChevronLeft } from '@tabler/icons-react';
import { Badge, Card, Group, Stack, Text, Title } from '@mantine/core';
import { requireSession } from '@/lib/auth';
import { faCurrency, faJalaliLongDate, faNumber } from '@/lib/format';
import { listCustomerReturns } from '@/lib/product-returns';
import {
  customerNextStep,
  RETURN_METHOD_LABELS,
  RETURN_SHIPPING_PAYER_LABELS,
  RETURN_STATUS_COLORS,
  RETURN_STATUS_LABELS,
  type ReturnMethod,
  type ReturnShippingPayer,
  type ReturnStatus,
} from '@/lib/return-status';

export const metadata: Metadata = {
  title: 'مرجوعی‌های من',
};

export const dynamic = 'force-dynamic';

/**
 * «مرجوعی‌های من» — کارت‌های درخواست مرجوعی مشتری با وضعیت و گام بعدی؛
 * جزئیات و تایم‌لاین هر درخواست در صفحه اختصاصی خودش است.
 */
export default async function AccountReturnsPage() {
  const session = await requireSession('/account/returns');
  const returns = await listCustomerReturns(session.sub);

  return (
    <Card withBorder>
      <Title order={2} fz="h5" mb="md">
        مرجوعی‌های من
      </Title>

      {returns.length === 0 ? (
        <Stack gap="xs" py="xl" align="center">
          <IconArrowBackUp size={28} stroke={1.5} color="var(--mantine-color-dimmed)" />
          <Text size="sm" c="dimmed" ta="center">
            درخواست مرجوعی ثبت نشده است. برای سفارش‌های تحویل‌شده، از کارت سفارش در{' '}
            <Link
              href="/account/orders"
              style={{ color: 'var(--mantine-color-brand-text)', textDecoration: 'none' }}
            >
              سفارش‌های من
            </Link>{' '}
            می‌توانید درخواست بدهید.
          </Text>
        </Stack>
      ) : (
        <Stack gap="sm">
          {returns.map((row) => {
            const method = row.returnMethod;
            const payer = row.shippingPayer;
            return (
              // Link خالص دور Card — پاس‌دادن component={Link} به کامپوننت کلاینتی
              // مانتین از سرکامپوننت، استریم gzip را با خطای «Functions cannot be
              // passed directly to Client Components» می‌شکند.
              <Link
                key={row.id}
                href={`/account/returns/${row.displayId}`}
                style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
              >
                <Card withBorder padding="md">
                  <Group justify="space-between" wrap="nowrap" gap="xs" mb={4}>
                    <Badge
                      variant="light"
                      color={RETURN_STATUS_COLORS[row.status as ReturnStatus]}
                      radius="sm"
                    >
                      {RETURN_STATUS_LABELS[row.status as ReturnStatus]}
                    </Badge>
                    <Text ff="monospace" fz="sm" fw={600}>
                      {row.displayId}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    سفارش {row.orderDisplayId} — {faNumber(row.itemCount)} قلم —{' '}
                    {faCurrency(row.refundedAmount ?? row.refundItemsAmount, false)}
                  </Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    {faJalaliLongDate(row.createdAt)}
                  </Text>
                  <Text
                    size="xs"
                    mt={4}
                    c={row.status === 'rejected' || row.status === 'cancelled' ? 'dimmed' : 'brand'}
                  >
                    گام بعدی: {customerNextStep(row.status as ReturnStatus, method, payer)}
                  </Text>
                  {method ? (
                    <Text size="xs" c="dimmed" mt={2}>
                      روش برگشت: {RETURN_METHOD_LABELS[method as ReturnMethod]}
                      {payer && method === 'self_ship'
                        ? ` — هزینه ارسال با ${RETURN_SHIPPING_PAYER_LABELS[payer as ReturnShippingPayer]}`
                        : ''}
                    </Text>
                  ) : null}
                  <Group justify="flex-end" mt={6} gap={4}>
                    <Text size="xs" c="brand">
                      جزئیات
                    </Text>
                    <IconChevronLeft size={14} color="var(--mantine-color-brand-6)" />
                  </Group>
                </Card>
              </Link>
            );
          })}
        </Stack>
      )}
    </Card>
  );
}
