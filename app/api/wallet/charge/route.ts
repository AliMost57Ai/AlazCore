import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { licensedGatewayIds } from '@/lib/core-license';
import prisma from '@/lib/db';
import { getAppSettings } from '@/lib/settings';
import { logSystemError } from '@/lib/system-logs';
import { zarinpalRequest } from '@/lib/zarinpal';

interface ChargeBody {
  amount?: unknown;
}

/** Charge amounts are in Toman; the gateway needs at least this much. */
const MIN_CHARGE_TOMAN = 1_000;
const MAX_CHARGE_TOMAN = 2_000_000_000;

/**
 * Starts an online wallet top-up: asks ZarinPal for an authority and returns
 * the gateway URL. The wallet itself is only credited on the callback, after
 * the payment is verified — an attempt row (state 'pending') is recorded here
 * per the payment-history requirement.
 */
export async function POST(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: ChargeBody;
  try {
    body = (await request.json()) as ChargeBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount < MIN_CHARGE_TOMAN || amount > MAX_CHARGE_TOMAN) {
    return NextResponse.json(
      {
        error: `مبلغ شارژ باید بین ${MIN_CHARGE_TOMAN.toLocaleString('en-US')} و ۲ میلیارد تومان باشد.`,
      },
      { status: 400 }
    );
  }

  const settings = await getAppSettings();
  if (!settings.zarinpalMerchantId) {
    return NextResponse.json(
      { error: 'درگاه پرداخت هنوز پیکربندی نشده است. با پشتیبانی فروشگاه تماس بگیرید.' },
      { status: 400 }
    );
  }

  // شارژ کیف پول فقط از درگاه‌های مجازِ پلن Core این دامنه (بند ۲-۸) —
  // این مسیر همیشه zarinpal است، پس اگر Core آن را برای دامنه فعال نکرده،
  // به اولین درگاه IPG آماده‌ی مجاز منتقل نمی‌شویم بلکه خطای شفاف می‌دهیم.
  const licensed = await licensedGatewayIds('ipg');
  if (licensed && !licensed.has('zarinpal')) {
    return NextResponse.json(
      { error: 'درگاه زرین‌پال برای این سایت فعال نیست. با پشتیبانی تماس بگیرید.' },
      { status: 400 }
    );
  }

  const result = await zarinpalRequest({
    merchantId: settings.zarinpalMerchantId,
    sandbox: settings.zarinpalSandbox,
    amountToman: amount,
    callbackUrl: `${request.nextUrl.origin}/api/payment/callback`,
    description: 'شارژ کیف پول',
    mobile: session.phone,
  });

  if (!result.ok) {
    // شروع پرداخت ناموفق هم باید در لاگ‌های سیستم بماند — همان قرارداد
    // checkout و لینک پرداخت؛ وگرنه شکست پرداخت هیچ ردی به جا نمی‌گذارد.
    await logSystemError({
      kind: 'gateway',
      provider: 'zarinpal',
      action: 'start',
      message: result.error,
      detail: `شارژ کیف پول ${amount} تومان — کاربر ${session.sub}`,
    });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  await prisma.onlinePaymentTransaction.create({
    data: {
      userId: session.sub,
      kind: 'wallet_charge',
      amount,
      state: 'pending',
      authority: result.authority,
    },
  });

  return NextResponse.json({ redirectUrl: result.startPayUrl });
}
