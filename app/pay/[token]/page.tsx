import type { Metadata } from 'next';
import { Center, Container, Stack, Text, Title } from '@mantine/core';
import PayLinkForm, { type PayLinkGateway, type PayLinkOrder } from '@/components/pay/PayLinkForm';
import prisma from '@/lib/db';
import { activeGatewaysFor, defaultGatewayFor } from '@/lib/gateways/registry';
import type { OrderStatus } from '@/lib/order-status';
import { getAppSettings } from '@/lib/settings';
import { parseItems } from '@/lib/shop-orders';
import { ensureSiteContext } from '@/lib/site-context';
import { getSiteSettings } from '@/lib/theme-settings';

export const metadata: Metadata = {
  title: 'پرداخت فاکتور',
};

export const dynamic = 'force-dynamic';

/**
 * The public pay page behind a shared payment link: the order's invoice and a
 * pay button — no login, no changes. The random paymentToken in the URL is the
 * only capability; the page renders nothing but an error for unknown tokens.
 */
export default async function PayLinkPage({ params }: { params: Promise<{ token: string }> }) {
  await ensureSiteContext();
  const { token } = await params;

  const order = await prisma.order.findUnique({ where: { paymentToken: token } });

  if (!order) {
    return (
      <Container size="sm" py="xl">
        <Center mih={200}>
          <Stack align="center" gap="xs">
            <Title order={1} fz="h4">
              فاکتور یافت نشد
            </Title>
            <Text size="sm" c="dimmed">
              این لینک پرداخت معتبر نیست یا حذف شده است.
            </Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  // The gateways the admin activated AND configured — same picker the
  // checkout shows, with the admin's default preselected.
  const settings = await getAppSettings();
  const gateways: PayLinkGateway[] = activeGatewaysFor(settings).map((gateway) => ({
    id: gateway.id,
    label: gateway.label,
    kind: gateway.kind,
  }));
  const defaultGateway = defaultGatewayFor(settings)?.id ?? null;

  const site = await getSiteSettings();

  const payOrder: PayLinkOrder = {
    displayId: order.displayId,
    date: order.date,
    status: order.status as OrderStatus,
    items: parseItems(order.itemsJson),
    amount: order.amount,
    discountAmount: order.discountAmount,
    couponCode: order.couponCode,
    shippingCost: order.shippingCost,
    deliveryMethod: order.deliveryMethod,
  };

  return (
    <Container size="sm" py={{ base: 'md', sm: 'xl' }}>
      <Stack gap="md">
        <Text size="sm" c="dimmed" ta="center">
          {site.siteName}
        </Text>
        <PayLinkForm
          token={token}
          order={payOrder}
          gateways={gateways}
          defaultGateway={defaultGateway}
        />
      </Stack>
    </Container>
  );
}
