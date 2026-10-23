/**
 * ZarinPal online payment gateway (Payment Gateway v4 REST API).
 *
 * Flow, per https://www.zarinpal.com/docs/paymentGateway/:
 *  1. POST /pg/v4/payment/request.json with the merchant ID, amount and
 *     callback URL → receives an `authority`.
 *  2. Redirect the customer to /pg/StartPay/{authority} on the gateway host.
 *  3. The gateway redirects back to the callback URL with
 *     ?Authority=…&Status=OK|NOK.
 *  4. POST /pg/v4/payment/verify.json with the same merchant ID, amount and
 *     authority. data.code 100 = verified, 101 = already verified (also a
 *     success for our purposes); anything else failed.
 *
 * Amounts are sent in Rial — order amounts in this app are Toman, so ×10.
 * Sandbox mode swaps the gateway host to sandbox.zarinpal.com for testing
 * without real money.
 */

const REQUEST_TIMEOUT_MS = 20_000;

export interface ZarinpalRequestInput {
  merchantId: string;
  sandbox: boolean;
  /** Order total in Toman. */
  amountToman: number;
  /** Absolute URL ZarinPal redirects back to after payment. */
  callbackUrl: string;
  description: string;
  /** Customer mobile, passed as metadata for the gateway receipt. */
  mobile?: string | null;
}

export type ZarinpalRequestResult =
  | { ok: true; authority: string; startPayUrl: string }
  | { ok: false; error: string };

export type ZarinpalVerifyResult =
  | { ok: true; refId: string; alreadyVerified: boolean }
  | { ok: false; error: string };

function gatewayBase(sandbox: boolean): string {
  return sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
}

interface ZarinpalEnvelope {
  data?: {
    code?: number;
    authority?: string;
    ref_id?: number;
    message?: string;
  } | null;
  errors?: unknown;
}

/** Persian error copy for the error codes the gateway actually surfaces. */
function requestError(code: number | undefined, fallback: string): string {
  switch (code) {
    case -9:
      return 'خطای اعتبارسنجی درگاه پرداخت — کلید فروشندگی یا مبلغ نامعتبر است.';
    case -10:
      return 'درگاه پرداخت برای این وب‌سایت فعال نیست (آدرس بازگشت یا دامنه تأیید نشده).';
    case -11:
      return 'درگاه پرداخت به حالت تعلیق درآمده است.';
    case -12:
      return 'تنظیمات درگاه پرداخت برای این وب‌سایت ناقص است.';
    case -15:
      return 'آدرس بازگشت (کال‌بک) با آدرس ثبت‌شده درگاه هم‌خوانی ندارد.';
    case -50:
      return 'مبلغ پرداخت با مبلغ ثبت‌شده در درگاه برابر نیست.';
    case -51:
      return 'پرداخت ناموفق بوده یا توسط مشتری لغو شده است.';
    case -53:
      return 'پرداخت متعلق به این فروشنده نیست.';
    case -54:
      return 'کد مرجع نامعتبر است.';
    default:
      return `${fallback} (کد ${code ?? '?'})`;
  }
}

async function postJson(url: string, body: Record<string, unknown>): Promise<ZarinpalEnvelope> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as ZarinpalEnvelope;
}

/** Step 1: asks the gateway for an authority and the redirect URL. */
export async function zarinpalRequest(input: ZarinpalRequestInput): Promise<ZarinpalRequestResult> {
  const amountRial = input.amountToman * 10;

  let envelope: ZarinpalEnvelope;
  try {
    envelope = await postJson(`${gatewayBase(input.sandbox)}/pg/v4/payment/request.json`, {
      merchant_id: input.merchantId,
      amount: amountRial,
      callback_url: input.callbackUrl,
      description: input.description,
      metadata: input.mobile ? { mobile: input.mobile } : undefined,
    });
  } catch {
    return { ok: false, error: 'ارتباط با درگاه پرداخت برقرار نشد. کمی بعد دوباره تلاش کنید.' };
  }

  const code = envelope.data?.code;
  const authority = envelope.data?.authority;

  if (code === 100 && authority) {
    return {
      ok: true,
      authority,
      startPayUrl: `${gatewayBase(input.sandbox)}/pg/StartPay/${authority}`,
    };
  }

  return { ok: false, error: requestError(code, 'ایجاد درخواست پرداخت ناموفق بود.') };
}

/** Step 3: verifies a completed payment against its authority. */
export async function zarinpalVerify(input: {
  merchantId: string;
  sandbox: boolean;
  amountToman: number;
  authority: string;
}): Promise<ZarinpalVerifyResult> {
  let envelope: ZarinpalEnvelope;
  try {
    envelope = await postJson(`${gatewayBase(input.sandbox)}/pg/v4/payment/verify.json`, {
      merchant_id: input.merchantId,
      amount: input.amountToman * 10,
      authority: input.authority,
    });
  } catch {
    return { ok: false, error: 'ارتباط با درگاه پرداخت برای تأیید تراکنش برقرار نشد.' };
  }

  const code = envelope.data?.code;

  // 100 = verified now, 101 = already verified (e.g. callback retried).
  if ((code === 100 || code === 101) && envelope.data?.ref_id) {
    return {
      ok: true,
      refId: String(envelope.data.ref_id),
      alreadyVerified: code === 101,
    };
  }

  return { ok: false, error: requestError(code, 'تأیید پرداخت ناموفق بود.') };
}
