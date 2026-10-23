/**
 * Vibe BNPL gateway (خرید اعتباری وایب), ported from the C# IpgFactory
 * implementation (VibeGateway.cs).
 *
 * Flow:
 *  1. POST https://credit.vibe.ir/merchants/api/v1/orders/ with the X-API-Key
 *     header and { order_id, cart_amount (Rial), cart_amount_installment,
 *     installments, callback_url, data: { goods_amount (≈90% of the cart),
 *     tax (≈10%), items: [{ id, name, price, quantity, discount }] } } →
 *     success is a response with a payment_url and an EMPTY detail array.
 *  2. Redirect the customer to payment_url.
 *  3. The gateway redirects back with our order_id (providerId).
 *  4. POST .../orders/verify with { ref_id: order_id } → status: true.
 *
 * Amounts are in Rial — order amounts here are Toman, so ×10.
 */

import {
  postJson,
  type GatewayCartItem,
  type GatewayStartContext,
  type GatewayStartResult,
  type GatewayVerifyContext,
  type GatewayVerifyResult,
} from './types';

const ORDERS_URL = 'https://credit.vibe.ir/merchants/api/v1/orders';

interface VibeOrderResponse {
  payment_url?: string;
  detail?: unknown[];
  message?: string;
  error?: string;
}

interface VibeVerifyResponse {
  status?: boolean;
  message?: string;
  first_installment_date?: string;
}

/** Cart items in Vibe's shape (prices in Rial). */
function vibeItems(items: GatewayCartItem[]) {
  const lines = items.length > 0 ? items : [{ name: 'سفارش', qty: 1, unitPrice: 0 }];
  return lines.map((item, index) => ({
    id: String(index + 1),
    name: item.name,
    price: item.unitPrice * 10,
    quantity: item.qty,
    discount: 0,
  }));
}

export async function vibeStart(ctx: GatewayStartContext): Promise<GatewayStartResult> {
  const amountRial = ctx.amountToman * 10;
  // Vibe splits the cart into goods (~90%) and tax (~10%).
  const goodsAmount = Math.floor((amountRial * 9) / 10);
  const installments = Number(ctx.settings.vibeInstallments) || 3;

  let payload: VibeOrderResponse;
  try {
    payload = await postJson(
      ORDERS_URL,
      {
        order_id: ctx.providerId,
        cart_amount: amountRial,
        cart_amount_installment: amountRial,
        installments,
        callback_url: ctx.callbackUrl,
        data: {
          goods_amount: goodsAmount,
          tax: amountRial - goodsAmount,
          items: vibeItems(ctx.items),
        },
      },
      { 'X-API-Key': ctx.settings.vibeApiKey }
    );
  } catch {
    return { ok: false, error: 'ارتباط با درگاه وایب برقرار نشد. کمی بعد دوباره تلاش کنید.' };
  }

  // Success = a payment URL and no error detail attached.
  if (payload.payment_url && (!Array.isArray(payload.detail) || payload.detail.length === 0)) {
    return { ok: true, redirectUrl: payload.payment_url, providerId: ctx.providerId };
  }

  return {
    ok: false,
    error: payload.message ?? payload.error ?? 'ایجاد درخواست پرداخت وایب ناموفق بود.',
  };
}

export async function vibeVerify(ctx: GatewayVerifyContext): Promise<GatewayVerifyResult> {
  let payload: VibeVerifyResponse;
  try {
    payload = await postJson(
      `${ORDERS_URL}/verify`,
      { ref_id: ctx.providerId },
      { 'X-API-Key': ctx.settings.vibeApiKey }
    );
  } catch {
    return { ok: false, error: 'ارتباط با درگاه وایب برای تأیید تراکنش برقرار نشد.' };
  }

  if (payload.status === true) {
    const refId = ctx.params.trackingcode ?? ctx.params.refid ?? ctx.providerId;
    return { ok: true, refId };
  }

  return { ok: false, error: payload.message ?? 'تأیید پرداخت وایب ناموفق بود.' };
}
