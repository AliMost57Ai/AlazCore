/**
 * Melipayamak SMS provider (https://melipayamak.com), per the classic REST
 * API at rest.payamak-panel.com.
 *
 *  - Normal SMS: POST /api/SendSMS/SendSMS, form-encoded
 *    { username, password, to, from, text, isflash: false }. The panel line
 *    (from) sends the rendered template text; the password is the panel's
 *    "API password" (رمز عبور وبسرویس), not the login password.
 *
 * Success = HTTP 200 with RetStatus 1 and a numeric recId (Value). Known
 * error codes: 0 = wrong username/password, 2 = insufficient credit,
 * 3 = daily limit reached, 11 = invalid sender line.
 *
 * Melipayamak's pattern-like "shared" lines are not used — order messages
 * always go out as plain text through this panel.
 */

const REQUEST_TIMEOUT_MS = 20_000;

export interface SendSmsInput {
  username: string;
  password: string;
  /** The panel's sending line, e.g. '5000xxxx'. */
  lineNumber: string;
  /** Customer mobile, e.g. '09121234567'. */
  receptor: string;
  message: string;
}

export type SendSmsResult = { ok: true } | { ok: false; error: string };

interface MelipayamakEnvelope {
  Value?: string;
  RetStatus?: number;
  StrRetStatus?: string;
}

/** Persian error copy for the codes the service actually surfaces. */
function sendError(value: string | undefined, retStatus: number | undefined): string {
  switch (value) {
    case '0':
      return 'ارسال پیامک ناموفق بود: نام کاربری یا رمز وبسرویس پنل اشتباه است.';
    case '2':
      return 'ارسال پیامک ناموفق بود: موجودی پنل پیامک به پایان رسیده است.';
    case '3':
      return 'ارسال پیامک ناموفق بود: سقف ارسال روزانه پنل پر شده است.';
    case '11':
      return 'ارسال پیامک ناموفق بود: خط ارسال نامعتبر است.';
    default:
      return `ارسال پیامک ناموفق بود (کد ${value ?? retStatus ?? '?'}).`;
  }
}

/** Sends a plain-text SMS through the panel's line. */
export async function sendMelipayamakSms(input: SendSmsInput): Promise<SendSmsResult> {
  let envelope: MelipayamakEnvelope;
  try {
    const response = await fetch('https://rest.payamak-panel.com/api/SendSMS/SendSMS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        username: input.username,
        password: input.password,
        to: input.receptor,
        from: input.lineNumber,
        text: input.message,
        isflash: 'false',
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { ok: false, error: `ارسال پیامک ناموفق بود (HTTP ${response.status}).` };
    }

    envelope = (await response.json().catch(() => ({}))) as MelipayamakEnvelope;
  } catch {
    return { ok: false, error: 'ارتباط با سرویس پیامک برقرار نشد.' };
  }

  // RetStatus 1 + a numeric recId means the message was accepted for sending.
  if (envelope.RetStatus === 1 && envelope.Value && /^\d+$/.test(envelope.Value)) {
    return { ok: true };
  }

  return { ok: false, error: sendError(envelope.Value, envelope.RetStatus) };
}
