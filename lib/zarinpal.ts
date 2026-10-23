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
  | {
      ok: true;
      refId: string;
      alreadyVerified: boolean;
      /** شماره کارت ماسک‌شده از پاسخ verify — null وقتی درگاه نفرستاده. */
      cardPan: string | null;
      /** کارمزد تراکنش به ریال — null وقتی درگاه نفرستاده. */
      feeRial: number | null;
      /** 'Merchant' | 'Payer' | … */
      feeType: string | null;
    }
  | { ok: false; error: string };

function gatewayBase(sandbox: boolean): string {
  return sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
}

interface ZarinpalErrorItem {
  message?: string;
  code?: number;
}

interface ZarinpalEnvelope {
  data?: {
    code?: number;
    authority?: string;
    ref_id?: number;
    message?: string;
    /** شماره کارت ماسک‌شده پرداخت‌کننده در پاسخ verify. */
    card_pan?: string;
    /** کارمزد تراکنش (ریال). */
    fee?: number;
    fee_type?: string;
  } | null;
  /**
   * خطاهای بیزینسی درگاه — زرین‌پال این‌ها را با HTTP 422 می‌فرستد، نه 200.
   * دقت: روی «موفقیت» هم errors می‌آید ولی به‌صورت آرایه خالی `[]` (تأیید
   * واقعی با sandbox) — آرایه خالی در JS truthy است و نباید خطا خوانده شود.
   */
  errors?: ZarinpalErrorItem | ZarinpalErrorItem[] | null;
}

/** اولین خطای واقعی envelope — آرایه خالی «بی‌خطا» است. */
function firstError(envelope: ZarinpalEnvelope): ZarinpalErrorItem | null {
  const errors = envelope.errors;
  if (!errors) {
    return null;
  }
  if (Array.isArray(errors)) {
    return errors.length > 0 ? (errors[0] ?? null) : null;
  }
  return errors;
}

/** پیام فارسی از خطای envelope؛ بدون کد شناخته‌شده، پیام خود درگاه. */
function envelopeError(error: ZarinpalErrorItem, fallback: string): string {
  const code = error.code;
  const message = error.message;
  if (typeof code === 'number') {
    // پیام فارسی الگو + پیام خود درگاه در پرانتز برای دیباگ آسان.
    const base = requestError(code, message ?? fallback);
    return message && !base.includes(message) ? `${base} (${message})` : base;
  }
  return message ? `${message}` : fallback;
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
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (error) {
    // قطع واقعی شبکه — کد علت (ETIMEDOUT و…) برای لاگ سرور.
    const cause = (error as { cause?: { code?: string } }).cause?.code ?? '';
    throw new ConnectionError(`${(error as Error).message}${cause ? ` (${cause})` : ''}`);
  }

  // زرین‌پال خطاهای بیزینسی را با HTTP 422 + envelope errors برمی‌گرداند —
  // پاسخ غیر-200 خودش خطای اتصال نیست؛ envelope را بخوان.
  try {
    return (await response.json()) as ZarinpalEnvelope;
  } catch {
    throw new ConnectionError(`HTTP ${response.status} با بدنه غیر JSON`);
  }
}

/** خطای لایه اتصال/پروتکل — از خطای بیزینسی درگاه جدا است. */
class ConnectionError extends Error {}

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
  } catch (error) {
    if (error instanceof ConnectionError) {
      console.error(
        `[zarinpal] request به ${gatewayBase(input.sandbox)} ناموفق:`,
        (error as Error).message
      );
      return {
        ok: false,
        error: `ارتباط با درگاه پرداخت (${gatewayBase(input.sandbox)}) برقرار نشد — از در دسترس بودن سرور به این آدرس مطمئن شوید.`,
      };
    }
    throw error;
  }

  const failure = firstError(envelope);
  if (failure) {
    return { ok: false, error: envelopeError(failure, 'ایجاد درخواست پرداخت ناموفق بود.') };
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
  } catch (error) {
    if (error instanceof ConnectionError) {
      console.error(
        `[zarinpal] verify به ${gatewayBase(input.sandbox)} ناموفق:`,
        (error as Error).message
      );
      return { ok: false, error: 'ارتباط با درگاه پرداخت برای تأیید تراکنش برقرار نشد.' };
    }
    throw error;
  }

  const failure = firstError(envelope);
  if (failure) {
    return { ok: false, error: envelopeError(failure, 'تأیید پرداخت ناموفق بود.') };
  }

  const code = envelope.data?.code;

  // 100 = verified now, 101 = already verified (e.g. callback retried).
  if ((code === 100 || code === 101) && envelope.data?.ref_id) {
    return {
      ok: true,
      refId: String(envelope.data.ref_id),
      alreadyVerified: code === 101,
      // اطلاعات پرداخت که درگاه بعد از تأیید برمی‌گرداند — برای نمایش تراکنش‌ها.
      cardPan: envelope.data.card_pan ?? null,
      feeRial: typeof envelope.data.fee === 'number' ? envelope.data.fee : null,
      feeType: envelope.data.fee_type ?? null,
    };
  }

  return { ok: false, error: requestError(code, 'تأیید پرداخت ناموفق بود.') };
}
