import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import CheckoutForm, {
  type CheckoutGateway,
  type CheckoutShippingMethod,
} from '@/components/account/CheckoutForm';
import { requireSession } from '@/lib/auth';
import { activeGatewaysFor, defaultGatewayFor } from '@/lib/gateways/registry';
import { getAppSettings } from '@/lib/settings';
import { listActiveShippingMethods } from '@/lib/shipping';
import { listCustomerOrders } from '@/lib/shop-orders';
import { getWalletBalance } from '@/lib/wallet';
import classes from '../page.module.css';

export const metadata: Metadata = {
  title: 'پرداخت سفارش',
};

export const dynamic = 'force-dynamic';

/**
 * The checkout steps as their own page — the cart drawer and the orders list
 * both send the buyer here. The products and the total are shown up front; the
 * stepper then walks through address → delivery method → online payment.
 *
 * Deliberately OUTSIDE /account: paying for your own order is part of the shop
 * flow, so staff buying for themselves must not be bounced to /dashboard by
 * the customer-area guard — only the customer profile pages are customer-only.
 *
 * `order` is the order's display id (ORD-12345); the order must be the buyer's
 * own unpaid order, otherwise they're sent back to the orders list.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const session = await requireSession('/checkout');
  const { order: displayId } = await searchParams;

  if (!displayId) {
    redirect('/account/orders');
  }

  const order = (await listCustomerOrders(session.sub)).find((row) => row.displayId === displayId);
  const walletBalance = await getWalletBalance(session.sub);

  // The gateways the admin activated AND configured — unconfigured gateways
  // never show in the buyer's picker. The admin's default is preselected.
  const settings = await getAppSettings();
  const gateways: CheckoutGateway[] = activeGatewaysFor(settings).map((gateway) => ({
    id: gateway.id,
    label: gateway.label,
    kind: gateway.kind,
  }));
  const defaultGateway = defaultGatewayFor(settings)?.id ?? null;

  // Only the admin's ACTIVE shipping methods reach the buyer's picker —
  // deactivated ones stay manageable in the admin page but disappear here.
  const shippingMethods: CheckoutShippingMethod[] = (await listActiveShippingMethods()).map(
    (method) => ({
      id: method.id,
      name: method.name,
      description: method.description,
      minDeliveryDays: method.minDeliveryDays,
      minShippingCost: method.minShippingCost,
      isInvoiced: method.isInvoiced,
    })
  );

  // Not the buyer's order, or it's already past payment — nothing to pay.
  if (!order || order.status !== 'pending') {
    redirect('/account/orders');
  }

  return (
    <div className={classes.page}>
      <div className={classes.wrap}>
        <CheckoutForm
          order={{
            id: order.id,
            displayId: order.displayId,
            amount: order.amount,
            items: order.items,
          }}
          walletBalance={walletBalance}
          gateways={gateways}
          defaultGateway={defaultGateway}
          shippingMethods={shippingMethods}
          successHref={session.role === 'customer' ? '/account/orders' : '/'}
        />
      </div>
    </div>
  );
}
