import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { gatewayLabel, getGateway } from '@/lib/gateways/registry';
import { toJalaliAscii } from '@/lib/gateways/types';
import { sendOrderFactorSms } from '@/lib/order-sms';
import { getAppSettings } from '@/lib/settings';
import { ensureSiteContext } from '@/lib/site-context';
import { logSystemError, logSystemEvent } from '@/lib/system-logs';
import { creditWallet, payOrderFromWallet } from '@/lib/wallet';

/**
 * The payment callback every gateway returns to — browser redirects (GET)
 * and server/browser form- or JSON-POSTs alike.
 *
 * Wallet-first payment model: the gateway money always lands in the wallet
 * first — the pending transaction row (kind 'wallet_charge', optional
 * orderId) is found by whatever identifier the gateway echoed back (its
 * token in the authority column, or our providerId), verified against the
 * gateway through the registry, the wallet is credited, and when the charge
 * was tied to an order that order is then paid from the wallet
 * automatically.
 *
 * Orders paid through the pre-wallet flow are still handled: their ZarinPal
 * authority lives on the order row itself (paymentAuthority).
 *
 * Public on purpose: the gateway knows nothing about our session cookie. The
 * stored identifier alone is the capability; it is only ever accepted
 * together with a successful verify against the exact stored amount.
 */

/** Param keys that may carry one of our stored transaction identifiers. */
const ID_KEYS = [
  'authority', // ZarinPal, MiniPay
  'token', // Saman, Sepah, SizPay, Keepa
  'refnum', // Saman / Sepah reference
  'resnum', // Saman's echo of our providerId
  'orderid', // Parsian / Mellat / Sadad numeric ids, IdPay order_id
  'order_id',
  'invoice', // Pasargad invoice (= our providerId)
  'trackingcode', // DigiPay / SnappPay / Tara / Vibe
  'providerid',
  'urlid', // Pasargad urlId
] as const;

function collectParams(entries: Iterable<[string, string]>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (typeof value === 'string' && value !== '') {
      params[key.toLowerCase()] = value;
    }
  }
  return params;
}

/** Reads POST bodies as JSON (DigiPay-style) or form data (relay gateways). */
async function readPostParams(request: NextRequest): Promise<Record<string, string> | null> {
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const payload: unknown = await request.json();
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
      }
      const entries: [string, string][] = [];
      for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
        if (['string', 'number', 'boolean'].includes(typeof value)) {
          entries.push([key, String(value)]);
        }
      }
      return collectParams(entries);
    }
    const form = await request.formData();
    return collectParams(
      [...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
  } catch {
    return null;
  }
}

/** Candidate identifier values from the callback, deduplicated. */
function idCandidates(params: Record<string, string>): string[] {
  const values = new Set<string>();
  for (const key of ID_KEYS) {
    const value = params[key];
    if (typeof value === 'string' && value.trim() !== '') {
      values.add(value.trim());
    }
  }
  return [...values];
}

async function settleCallback(
  request: NextRequest,
  params: Record<string, string>
): Promise<NextResponse> {
  const toOrders = (query: Record<string, string>) =>
    NextResponse.redirect(
      new URL(`/account/orders?${new URLSearchParams(query).toString()}`, request.url)
    );
  const toWallet = (query: Record<string, string>) =>
    NextResponse.redirect(
      new URL(`/account/wallet?${new URLSearchParams(query).toString()}`, request.url)
    );

  const candidates = idCandidates(params);
  if (candidates.length === 0) {
    // بازگشت بی‌شناسه از درگاه — قبلاً کاملاً بی‌لاگ بود و ردِ پرداختِ شکست‌خورده
    // پیدا نمی‌شد؛ حالا در لاگ‌های سیستم (فیلتر «درگاه پرداخت») می‌ماند.
    await logSystemEvent({
      kind: 'gateway',
      provider: 'callback',
      action: 'unknown_callback',
      message: 'بازگشتی از درگاه بدون هیچ شناسهٔ قابل شناسایی رسید.',
      actorName: '',
      detail: Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join(', '),
    });
    return toOrders({ payment: 'unknown' });
  }

  // Find the pending/verified transaction behind the callback: by the
  // gateway's token (unique authority column) first, then by our providerId
  // (latest attempt wins — a retried checkout creates a newer row).
  let transaction = null as Awaited<ReturnType<typeof findTransaction>>;
  for (const candidate of candidates) {
    transaction = await findTransaction(candidate);
    if (transaction) {
      break;
    }
  }

  // Legacy orders: the ZarinPal authority used to live on the order row itself.
  let legacyOrder = null as Awaited<ReturnType<typeof findLegacyOrder>>;
  if (!transaction) {
    for (const candidate of candidates) {
      legacyOrder = await findLegacyOrder(candidate);
      if (legacyOrder) {
        break;
      }
    }
  }
  if (!transaction && !legacyOrder) {
    // شناسه‌ها رسیدند ولی به هیچ تراکنش/سفارشی نخوردند — ردِ پرداختِ
    // شکست‌خورده بدون این لاگ گم می‌شد.
    await logSystemEvent({
      kind: 'gateway',
      provider: 'callback',
      action: 'unknown_callback',
      message: 'شناسه‌های بازگشت درگاه به هیچ تراکنش یا سفارشی match نشد.',
      actorName: '',
      detail: candidates.join(' | '),
    });
    return toOrders({ payment: 'unknown' });
  }

  const orderId = transaction?.orderId ?? legacyOrder?.id ?? null;

  const fail = async (): Promise<NextResponse> => {
    if (transaction) {
      await prisma.onlinePaymentTransaction
        .update({ where: { id: transaction.id }, data: { state: 'failed' } })
        .catch(() => undefined);
    }

    const query: Record<string, string> = { payment: 'failed' };
    if (legacyOrder) {
      return toOrders({ ...query, order: legacyOrder.displayId });
    }
    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { displayId: true },
      });
      if (order) {
        return toOrders({ ...query, order: order.displayId });
      }
    }
    return toWallet(query);
  };

  // ZarinPal tells us the outcome up front — skip the verify round-trip on a
  // customer cancellation.
  if (transaction?.gateway === 'zarinpal' && params.status !== 'OK') {
    // لغو پرداخت توسط مشتری در درگاه — قبلاً فقط ردیف failedِ تراکنش می‌ماند
    // و در لاگ‌های سیستم هیچ ردی نبود.
    await logSystemEvent({
      kind: 'gateway',
      provider: 'zarinpal',
      action: 'cancel',
      message: 'پرداخت در درگاه توسط مشتری لغو شد (پرداختی انجام نشد).',
      actorName: '',
      detail: `transaction ${transaction.id} — ${transaction.amount} تومان — status=${params.status}`,
    });
    return fail();
  }

  // Already settled (e.g. the gateway retried the callback): success without
  // hitting the verify endpoint again.
  if (transaction?.state === 'verified' || legacyOrder?.status === 'paid') {
    const refId = transaction?.refId ?? legacyOrder?.paymentRefId ?? '';
    if (orderId) {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      return toOrders({ payment: 'ok', order: order?.displayId ?? '', ref: refId });
    }
    return toWallet({ payment: 'ok', ref: refId });
  }

  const settings = await getAppSettings();

  // ---------------------------------------------------------------------
  // Legacy flow: ZarinPal paid the order directly.
  // ---------------------------------------------------------------------
  if (legacyOrder) {
    const gateway = getGateway('zarinpal');
    if (!gateway || !settings.zarinpalMerchantId) {
      await logSystemError({
        kind: 'gateway',
        provider: 'zarinpal',
        action: 'verify',
        message: 'درگاه زرین‌پال پیکربندی نشده است — تأیید بازگشت درگاه ممکن نشد.',
        detail: `order ${legacyOrder.displayId}`,
      });
      return fail();
    }

    const verified = await gateway.verify({
      settings,
      amountToman: legacyOrder.amount,
      providerId: '',
      token: legacyOrder.paymentAuthority,
      createdJalali: toJalaliAscii(legacyOrder.createdAt),
      params,
    });
    if (!verified.ok) {
      await logSystemError({
        kind: 'gateway',
        provider: 'zarinpal',
        action: 'verify',
        message: verified.error,
        detail: verified.detail,
      });
      return fail();
    }

    const updated = await prisma.order.update({
      where: { id: legacyOrder.id },
      data: { status: 'paid', paidAt: new Date(), paymentRefId: verified.refId },
    });

    try {
      const sms = await sendOrderFactorSms({
        order: {
          displayId: updated.displayId,
          amount: updated.amount,
          date: updated.date,
          paymentRefId: verified.refId,
          trackingCode: updated.trackingCode,
          userId: updated.userId,
        },
        refId: verified.refId,
      });
      if (!sms.ok) {
        console.error(`Factor SMS for order ${updated.displayId} failed: ${sms.error}`);
      }
    } catch (error) {
      console.error(`Factor SMS dispatch for order ${updated.displayId} failed:`, error);
    }

    return toOrders({ payment: 'ok', order: updated.displayId, ref: verified.refId });
  }

  // ---------------------------------------------------------------------
  // Wallet flow: verify through the registry, credit the wallet, then pay
  // the tied order from it.
  // ---------------------------------------------------------------------
  if (!transaction) {
    return toOrders({ payment: 'unknown' });
  }

  const gateway = getGateway(transaction.gateway);
  if (!gateway) {
    await logSystemError({
      kind: 'gateway',
      provider: transaction.gateway,
      action: 'verify',
      message: 'درگاه ثبت‌شدهٔ تراکنش در رجیستری یافت نشد.',
      detail: `transaction ${transaction.id}`,
    });
    return fail();
  }

  const verified = await gateway.verify({
    settings,
    amountToman: transaction.amount,
    providerId: transaction.providerId ?? '',
    token: transaction.authority,
    createdJalali: toJalaliAscii(transaction.createdAt),
    params,
  });
  if (!verified.ok) {
    await logSystemError({
      kind: 'gateway',
      provider: transaction.gateway,
      action: 'verify',
      message: verified.error,
      detail: verified.detail,
    });
    return fail();
  }

  // Guard the exact amount — when the gateway reports one, the Rial figure
  // must match the transaction we recorded at checkout (±10, Toman↔Rial).
  if (
    verified.amountRial !== undefined &&
    Math.abs(verified.amountRial - transaction.amount * 10) > 10
  ) {
    console.error(
      `Amount mismatch for ${transaction.providerId ?? transaction.id} (${transaction.gateway}): expected ${transaction.amount * 10} Rial, got ${verified.amountRial}`
    );
    await logSystemError({
      kind: 'gateway',
      provider: transaction.gateway,
      action: 'verify',
      message: 'مبلغ پرداختی با مبلغ تراکنش ثبت‌شده همخوانی ندارد.',
      detail: `expected ${transaction.amount * 10} Rial, gateway reported ${verified.amountRial}`,
    });
    return fail();
  }

  const order = transaction.orderId
    ? await prisma.order.findUnique({ where: { id: transaction.orderId } })
    : null;

  // The transaction returns the paid order (if the top-up auto-settled it) so
  // the factor SMS + redirect below work off plain flow analysis.
  const paidOrder = await prisma.$transaction(async (tx) => {
    await tx.onlinePaymentTransaction.update({
      where: { id: transaction.id },
      data: {
        state: 'verified',
        refId: verified.refId,
        // اطلاعات پرداخت درگاه بعد از تأیید — برای نمایش در تراکنش‌های درگاه.
        cardPan: verified.cardPan ?? null,
        verifyPayload: JSON.stringify({
          ...(verified.extra ?? {}),
          cardPan: verified.cardPan ?? null,
        }),
      },
    });

    await creditWallet(tx, {
      userId: transaction.userId,
      amount: transaction.amount,
      type: 'charge',
      reason: `شارژ آنلاین ${gatewayLabel(transaction.gateway)} — کد پیگیری ${verified.refId}`,
    });

    // Auto-pay the order this charge was for — if it is still pending and the
    // (now larger) balance covers it. Payable includes the invoiced shipping
    // cost stored at checkout.
    if (order && order.status === 'pending') {
      const payable = order.amount - order.discountAmount + order.shippingCost;
      const paid = await payOrderFromWallet(tx, {
        order: {
          id: order.id,
          displayId: order.displayId,
          userId: order.userId,
          couponCode: order.couponCode,
        },
        payable,
        refId: verified.refId,
      });
      if (paid) {
        return {
          id: order.id,
          displayId: order.displayId,
          date: order.date,
          userId: order.userId,
        };
      }
    }
    return null;
  });

  if (paidOrder) {
    try {
      const sms = await sendOrderFactorSms({
        order: {
          displayId: paidOrder.displayId,
          amount: order ? order.amount - order.discountAmount + order.shippingCost : 0,
          date: paidOrder.date,
          paymentRefId: verified.refId,
          trackingCode: null,
          userId: paidOrder.userId,
        },
        refId: verified.refId,
      });
      if (!sms.ok) {
        console.error(`Factor SMS for order ${paidOrder.displayId} failed: ${sms.error}`);
      }
    } catch (error) {
      console.error(`Factor SMS dispatch for order ${paidOrder.displayId} failed:`, error);
    }

    return toOrders({ payment: 'ok', order: paidOrder.displayId, ref: verified.refId });
  }

  // Charge-only (or the order was settled/concurrently handled): the money is
  // in the wallet either way.
  return toWallet({ payment: 'ok', ref: verified.refId });
}

async function findTransaction(candidate: string) {
  return (
    (await prisma.onlinePaymentTransaction.findUnique({
      where: { authority: candidate },
    })) ??
    (await prisma.onlinePaymentTransaction.findFirst({
      where: { providerId: candidate },
      orderBy: { createdAt: 'desc' },
    }))
  );
}

async function findLegacyOrder(candidate: string) {
  return prisma.order.findUnique({ where: { paymentAuthority: candidate } });
}

/**
 * استثنای پیش‌بینی‌نشده در مسیر callback قبلاً request را 500 می‌کرد بدون هیچ
 * لاگی — شکست پرداخت از دید فروشگاه نامرئی می‌شد. حالا قبل از ریدایرکت لاگ
 * می‌شود (logSystemError هرگز throw نمی‌کند).
 */
async function logCallbackCrash(request: NextRequest, error: unknown): Promise<NextResponse> {
  await logSystemError({
    kind: 'gateway',
    provider: 'callback',
    action: 'verify',
    message: 'خطای پیش‌بینی‌نشده در پردازش بازگشت از درگاه.',
    detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
  return NextResponse.redirect(new URL('/account/orders?payment=failed', request.url));
}

export async function GET(request: NextRequest) {
  await ensureSiteContext();
  try {
    return await settleCallback(request, collectParams(request.nextUrl.searchParams.entries()));
  } catch (error) {
    return logCallbackCrash(request, error);
  }
}

export async function POST(request: NextRequest) {
  const params = await readPostParams(request);
  if (!params) {
    return NextResponse.redirect(new URL('/account/orders?payment=unknown', request.url));
  }
  try {
    return await settleCallback(request, params);
  } catch (error) {
    return logCallbackCrash(request, error);
  }
}
