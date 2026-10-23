import type { Metadata } from 'next';
import { IconCircleCheck, IconCircleX } from '@tabler/icons-react';
import { Alert, Anchor, Card, Stack, Text, Title } from '@mantine/core';
import OrdersSection from '@/components/account/OrdersSection';
import { requireSession } from '@/lib/auth';
import { faCurrency } from '@/lib/format';
import { listCustomerOrders } from '@/lib/shop-orders';

export const metadata: Metadata = {
  title: 'سفارش‌های من',
};

export const dynamic = 'force-dynamic';

/** Payment outcome surfaced by the ZarinPal callback via query params. */
interface PaymentQuery {
  payment?: 'ok' | 'failed' | 'unknown';
  order?: string;
  ref?: string;
}

/**
 * The customer's order history as tracking cards, plus the online-payment
 * entry point for pending orders.
 */
export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<PaymentQuery>;
}) {
  const session = await requireSession('/account');

  const [orders, query] = await Promise.all([listCustomerOrders(session.sub), searchParams]);

  const paidOrder = query.payment === 'ok' ? orders.find((o) => o.displayId === query.order) : null;

  return (
    <Stack gap="md">
      {query.payment === 'ok' && paidOrder ? (
        <Alert
          variant="light"
          color="green"
          icon={<IconCircleCheck size={18} />}
          title="پرداخت با موفقیت انجام شد"
        >
          سفارش {paidOrder.displayId} به مبلغ {faCurrency(paidOrder.amount)} پرداخت شد.
          {query.ref ? ` کد پیگیری پرداخت: ${query.ref}` : ''} اطلاعات فاکتور برای شما پیامک شد.
        </Alert>
      ) : null}

      {query.payment === 'failed' && query.order ? (
        <Alert
          variant="light"
          color="red"
          icon={<IconCircleX size={18} />}
          title="پرداخت ناموفق بود"
        >
          پرداخت سفارش {query.order} تکمیل نشد. در صورت کسر مبلغ، تا ۷۲ ساعت به حساب شما بازمی‌گردد.
        </Alert>
      ) : null}

      {query.payment === 'unknown' ? (
        <Alert
          variant="light"
          color="orange"
          icon={<IconCircleX size={18} />}
          title="نتیجه پرداخت نامشخص است"
        >
          تراکنش بازگشتی با هیچ سفارشی مطابقت نداشت.
        </Alert>
      ) : null}

      <Card withBorder>
        <Title order={2} fz="h5" mb="md">
          سفارش‌های من
        </Title>

        {orders.length === 0 ? (
          <Text size="sm" c="dimmed" py="xl" ta="center">
            هنوز سفارشی ثبت نکرده‌اید. از{' '}
            <Anchor href="/" c="brand">
              فروشگاه
            </Anchor>{' '}
            دیدن کنید.
          </Text>
        ) : (
          <OrdersSection orders={orders} />
        )}
      </Card>
    </Stack>
  );
}
