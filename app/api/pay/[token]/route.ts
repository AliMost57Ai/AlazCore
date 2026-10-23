import { NextResponse, type NextRequest } from 'next/server';
import { licensedGatewayIds } from '@/lib/core-license';
import prisma from '@/lib/db';
import { activeGatewaysFor, defaultGatewayFor, getGateway } from '@/lib/gateways/registry';
import { getAppSettings } from '@/lib/settings';
import { parseItems } from '@/lib/shop-orders';
import { ensureSiteContext } from '@/lib/site-context';
import { logSystemError } from '@/lib/system-logs';

/**
 * The public pay endpoint behind /pay/{token}: starts a gateway payment for
 * the order the token points at — no session, the token IS the capability
 * (view + pay only; nothing about the order can be changed).
 *
 * The recipient pays the FULL payable amount (order − coupon + invoiced
 * shipping, as snapshotted when the link was shared). The gateway money lands
 * in the order owner's wallet on the callback, which auto-settles the order —
 * the same wallet-first flow as a regular checkout.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  await ensureSiteContext();
  const { token } = await context.params;

  let body: { gateway?: unknown } = {};
  try {
    body = (await request.json()) as { gateway?: unknown };
  } catch {
    // An empty body still pays with the admin's default gateway.
  }

  const order = await prisma.order.findUnique({ where: { paymentToken: token } });
  // An order without a user can't be settled wallet-first — treat it as gone.
  if (!order || !order.userId) {
    return NextResponse.json({ error: 'فاکتور یافت نشد.' }, { status: 404 });
  }
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'این فاکتور قبلاً پرداخت شده است.' }, { status: 400 });
  }

  const settings = await getAppSettings();
  // فقط درگاه‌هایی که پنل Core برای این دامنه فعال کرده (بند ۲-۸).
  const licensed = await licensedGatewayIds();
  const ready = activeGatewaysFor(settings);
  const available = licensed ? ready.filter((g) => licensed.has(g.id)) : ready;
  if (available.length === 0) {
    return NextResponse.json(
      {
        error: licensed
          ? 'هیچ درگاه پرداختی برای این سایت فعال نیست. با پشتیبانی تماس بگیرید.'
          : 'درگاه پرداختی پیکربندی نشده است. با پشتیبانی فروشگاه تماس بگیرید.',
      },
      { status: 400 }
    );
  }

  const requestedGateway =
    typeof body.gateway === 'string' && available.some((g) => g.id === body.gateway)
      ? getGateway(body.gateway)
      : null;
  const fallbackGateway = defaultGatewayFor(settings);
  const gateway =
    requestedGateway ??
    (fallbackGateway && available.some((g) => g.id === fallbackGateway.id)
      ? fallbackGateway
      : available[0]);
  if (!gateway) {
    return NextResponse.json(
      { error: 'درگاه انتخابی در دسترس نیست. دوباره تلاش کنید.' },
      { status: 400 }
    );
  }

  const payable = order.amount - order.discountAmount + order.shippingCost;
  // Captured for the closure below (property narrowing doesn't cross it).
  const ownerId = order.userId;

  const result = await gateway.start({
    settings,
    amountToman: payable,
    providerId: order.displayId,
    callbackUrl: `${request.nextUrl.origin}/api/payment/callback`,
    mobile: null,
    description: `پرداخت فاکتور ${order.displayId}`,
    items: parseItems(order.itemsJson).map((item) => ({
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice,
    })),
  });

  if (!result.ok) {
    // Same diagnostics as the checkout route — the raw API error goes to the
    // admin's system-log page.
    await logSystemError({
      kind: 'gateway',
      provider: gateway.id,
      action: 'start',
      message: result.error,
      detail: result.detail,
    });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.onlinePaymentTransaction.create({
      data: {
        userId: ownerId,
        kind: 'wallet_charge',
        amount: payable,
        state: 'pending',
        gateway: gateway.id,
        authority: result.token ?? null,
        providerId: result.providerId,
        refId: result.token ?? null,
        orderId: order.id,
      },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { paymentAuthority: result.providerId },
    });
  });

  return NextResponse.json({
    redirectUrl: result.redirectUrl,
    postUrl: result.postUrl ?? null,
    postFields: result.postFields ?? null,
    chargeAmount: payable,
  });
}
