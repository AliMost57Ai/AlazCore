import type { Metadata } from 'next';
import { IconCircleCheck, IconCircleX } from '@tabler/icons-react';
import { Alert, Badge, Card, Divider, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import ChargeWalletForm from '@/components/account/ChargeWalletForm';
import { requireSession } from '@/lib/auth';
import { faCurrency } from '@/lib/format';
import {
  getWalletBalance,
  listOnlinePayments,
  listWalletTransactions,
  PAYMENT_STATE_LABELS,
  WALLET_TX_LABELS,
} from '@/lib/wallet';

export const metadata: Metadata = {
  title: 'کیف پول',
};

export const dynamic = 'force-dynamic';

/** Payment outcome surfaced by the ZarinPal callback via query params. */
interface PaymentQuery {
  payment?: 'ok' | 'failed';
  ref?: string;
}

const PAYMENT_STATE_COLORS: Record<string, string> = {
  pending: 'yellow',
  verified: 'green',
  failed: 'red',
};

/**
 * The customer's wallet: balance, online top-up, and both histories — every
 * wallet movement (ledger) and every payment attempt with its state.
 */
export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<PaymentQuery>;
}) {
  const session = await requireSession('/account');
  const query = await searchParams;

  const [balance, transactions, payments] = await Promise.all([
    getWalletBalance(session.sub),
    listWalletTransactions(session.sub),
    listOnlinePayments(session.sub),
  ]);

  return (
    <Stack gap="md">
      {query.payment === 'ok' ? (
        <Alert
          variant="light"
          color="green"
          icon={<IconCircleCheck size={18} />}
          title="پرداخت با موفقیت انجام شد"
        >
          مبلغ به کیف پول شما افزوده شد.{query.ref ? ` کد پیگیری: ${query.ref}` : ''}
        </Alert>
      ) : null}

      {query.payment === 'failed' ? (
        <Alert
          variant="light"
          color="red"
          icon={<IconCircleX size={18} />}
          title="پرداخت ناموفق بود"
        >
          شارژ کیف پول تکمیل نشد. در صورت کسر مبلغ، تا ۷۲ ساعت به حساب شما بازمی‌گردد.
        </Alert>
      ) : null}

      <Card withBorder padding="md">
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Text size="sm" c="dimmed">
              موجودی کیف پول
            </Text>
            <Text fz="h3" fw={800}>
              {faCurrency(balance, false)}
            </Text>
          </div>
          <Text size="xs" c="dimmed" maw={280} ta="left">
            سفارش‌ها از موجودی کیف پول پرداخت می‌شوند؛ در صورت کافی نبودن، مبلغ کسری به‌صورت آنلاین
            شارژ و بلافاصله صرف پرداخت سفارش می‌شود.
          </Text>
        </Group>

        <Divider my="md" />

        <ChargeWalletForm />
      </Card>

      <Card withBorder padding="md">
        <Title order={2} fz="h6" mb="sm">
          تراکنش‌های کیف پول
        </Title>
        {transactions.length === 0 ? (
          <Text size="sm" c="dimmed" py="sm" ta="center">
            هنوز تراکنشی ثبت نشده است.
          </Text>
        ) : (
          <Stack gap="xs">
            {transactions.map((tx) => (
              <Group key={tx.id} justify="space-between" gap="xs" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Badge
                    variant="light"
                    color={tx.amount >= 0 ? 'green' : 'orange'}
                    radius="sm"
                    size="sm"
                  >
                    {WALLET_TX_LABELS[tx.type]}
                  </Badge>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {tx.reason ?? tx.orderId ?? '—'}
                  </Text>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <Text size="xs" c="dimmed">
                    {tx.date}
                  </Text>
                  <Text size="sm" fw={700} c={tx.amount >= 0 ? 'green' : undefined}>
                    {tx.amount >= 0 ? '+' : '−'}
                    {faCurrency(Math.abs(tx.amount), false)}
                  </Text>
                </Group>
              </Group>
            ))}
          </Stack>
        )}
      </Card>

      <Card withBorder padding="md">
        <Title order={2} fz="h6" mb="sm">
          تراکنش های درگاه پرداخت
        </Title>
        {payments.length === 0 ? (
          <Text size="sm" c="dimmed" py="sm" ta="center">
            هنوز تلاشی برای پرداخت آنلاین ثبت نشده است.
          </Text>
        ) : (
          <Stack gap="xs">
            {payments.map((payment) => (
              <SimpleGrid key={payment.id} cols={{ base: 1, sm: 4 }} spacing="xs">
                <Group gap="xs" wrap="nowrap">
                  <Badge
                    variant="light"
                    color={PAYMENT_STATE_COLORS[payment.state] ?? 'gray'}
                    radius="sm"
                    size="sm"
                  >
                    {PAYMENT_STATE_LABELS[payment.state]}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {payment.kind === 'wallet_charge' ? 'شارژ کیف پول' : 'پرداخت سفارش'}
                  </Text>
                </Group>
                <Text size="sm" fw={600}>
                  {faCurrency(payment.amount, false)}
                </Text>
                <Text size="xs" c="dimmed">
                  {payment.date}
                  {payment.refId ? ` — ${Number(payment.refId)}` : ''}
                </Text>
                <Text size="xs" c="dimmed" ff="monospace">
                  {payment.orderDisplayId ?? '—'}
                </Text>
              </SimpleGrid>
            ))}
          </Stack>
        )}
      </Card>
    </Stack>
  );
}
