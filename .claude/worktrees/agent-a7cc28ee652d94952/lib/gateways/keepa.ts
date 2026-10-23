/**
 * Keepa BNPL gateway (خرید اعتباری کیپا), ported from the C# IpgFactory
 * implementation (KeepaGateway.cs).
 *
 * Flow:
 *  1. POST https://sapi.keepa.ir/creditcore/thirdpartygateway/clients/
 *     authorize with { ClientId, ClientSecret } → AccessToken (cached).
 *  2. POST .../cpg-payments/v2/get-token with the Bearer token and
 *     { TerminalId, InvoiceNumber (numeric), Amount (Rial),
 *     CallbackUrl, Items: [...] } → Token + PaymentUrl.
 *  3. Redirect the customer to PaymentUrl.
 *  4. On the callback: GET .../cpg-payments/v2/inquiry/{token} → a Status
 *     enum (1 = verified, 8 = waiting-to-verify, 2 = pending, 3 = failed,
 *     …). Status 8 additionally needs POST .../cpg-payments/v2/verify with
 *     { Token, Amount } → success = a non-empty RefNum.
 *
 * Amounts are in Rial — order amounts here are Toman, so ×10.
 */

import {
  postJson,
  type GatewayStartContext,
  type GatewayStartResult,
  type GatewayVerifyContext,
  type GatewayVerifyResult,
} from './types';

const BASE = 'https://sapi.keepa.ir/creditcore/thirdpartygateway';

/** In-memory token cache — the access token outlives a checkout session. */
let cachedToken: { token: string; expiresAt: number } | null = null;

async function authorize(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const payload = await postJson<{ AccessToken?: string; TokenExpirationTime?: string }>(
    `${BASE}/clients/authorize`,
    { ClientId: clientId, ClientSecret: clientSecret }
  );
  if (!payload.AccessToken) {
    throw new Error('no access token');
  }
  // The expiration time is an opaque .NET timestamp — 30 minutes is a safe
  // cache window when it can't be parsed.
  cachedToken = { token: payload.AccessToken, expiresAt: Date.now() + 30 * 60_000 };
  return cachedToken.token;
}

interface KeepaTokenResponse {
  Token?: string;
  PaymentUrl?: string;
  Message?: string;
  IsSuccess?: boolean;
}

export async function keepaStart(ctx: GatewayStartContext): Promise<GatewayStartResult> {
  let accessToken: string;
  try {
    accessToken = await authorize(ctx.settings.keepaClientId, ctx.settings.keepaClientSecret);
  } catch (error) {
    return {
      ok: false,
      error: 'ورود به درگاه کیپا ناموفق بود. اطلاعات پنل را بررسی کنید.',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const amountRial = ctx.amountToman * 10;
  const lines = ctx.items.length > 0 ? ctx.items : [{ name: 'سفارش', qty: 1, unitPrice: 0 }];
  // Keepa validates the invoice number as numeric (the C# client sends a
  // datetime key + factor id) — our ORD-… display id would be rejected.
  // The callback carries the payment Token, so this stays internal.
  const invoiceNumber = `${Date.now()}${Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, '0')}`;

  let payload: KeepaTokenResponse;
  try {
    payload = await postJson(
      `${BASE}/cpg-payments/v2/get-token`,
      {
        TerminalId: Number(ctx.settings.keepaTerminalId) || 0,
        InvoiceNumber: invoiceNumber,
        Amount: amountRial,
        CallbackUrl: ctx.callbackUrl,
        Items: lines.map((item) => ({
          ItemName: item.name,
          ItemCode: '1',
          Quantity: item.qty,
          UnitName: 'عدد',
          // The provider's contract types UnitID as a string.
          UnitID: '1',
          UnitPrice: item.unitPrice * 10,
          Discount: 0,
          Vat: 0,
          Amount: item.unitPrice * item.qty * 10,
        })),
      },
      { Authorization: `Bearer ${accessToken}` }
    );
  } catch (error) {
    return {
      ok: false,
      error: 'ارتباط با درگاه کیپا برقرار نشد. کمی بعد دوباره تلاش کنید.',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  if (payload.Token && payload.PaymentUrl) {
    return {
      ok: true,
      redirectUrl: payload.PaymentUrl,
      token: payload.Token,
      providerId: ctx.providerId,
    };
  }

  return {
    ok: false,
    error: payload.Message ?? 'ایجاد درخواست پرداخت کیپا ناموفق بود.',
  };
}

/** Inquiry status enum (from the provider's v2 contract). */
enum KeepaStatus {
  Verified = 1,
  Pending = 2,
  Failed = 3,
  Unknown = 4,
  Contradiction = 5,
  PrepareToReverse = 6,
  Reversed = 7,
  WaitingToVerify = 8,
}

export async function keepaVerify(ctx: GatewayVerifyContext): Promise<GatewayVerifyResult> {
  const token = ctx.params.token ?? ctx.token;
  if (!token) {
    return { ok: false, error: 'توکن پرداخت کیپا در پاسخ درگاه نبود.' };
  }

  let accessToken: string;
  try {
    accessToken = await authorize(ctx.settings.keepaClientId, ctx.settings.keepaClientSecret);
  } catch (error) {
    return {
      ok: false,
      error: 'ورود به درگاه کیپا برای تأیید تراکنش ناموفق بود.',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  // Inquiry — the status is the source of truth.
  let status: number;
  let refNum: string | null = null;
  try {
    const response = await fetch(`${BASE}/cpg-payments/v2/inquiry/${encodeURIComponent(token)}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${(await response.text()).trim().slice(0, 500)}`);
    }
    const payload = (await response.json()) as { Status?: number; RefNum?: string; Token?: string };
    status = Number(payload.Status ?? 0);
    refNum = payload.RefNum ?? null;
  } catch (error) {
    return {
      ok: false,
      error: 'استعلام تراکنش کیپا ناموفق بود.',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  if (status === KeepaStatus.Verified) {
    return { ok: true, refId: refNum ?? token };
  }

  if (status === KeepaStatus.WaitingToVerify) {
    // One extra verify round-trip settles a waiting-to-verify purchase.
    try {
      const payload = await postJson<{ RefNum?: string }>(
        `${BASE}/cpg-payments/v2/verify`,
        { Token: token, Amount: ctx.amountToman * 10 },
        { Authorization: `Bearer ${accessToken}` }
      );
      if (payload.RefNum && payload.RefNum !== '') {
        return { ok: true, refId: payload.RefNum };
      }
    } catch {
      // Falls through to the failure below.
    }
  }

  return { ok: false, error: `وضعیت تراکنش کیپا قابل تأیید نیست (وضعیت ${status}).` };
}
