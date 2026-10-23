/**
 * Payam-Resan SMS provider (https://payam-resan.com), per its REST API.
 *
 *  - Normal SMS: POST https://api.payam-resan.com/SendSMS/SendSMS with
 *    { UserName, Password, SendDateTime: '', SMSMessageText, LineNumber,
 *    Mobiles: [receptor] }. The password is the panel's web-service password.
 *
 * Success = HTTP 200 with Code 0 (the message was queued); other codes carry
 * a Message (e.g. wrong credentials, no credit, invalid line).
 *
 * Payam-Resan has no pattern/template send — order messages always go out as
 * plain text through this panel.
 */

const REQUEST_TIMEOUT_MS = 20_000;

export interface SendSmsInput {
  username: string;
  password: string;
  /** The panel's sending line, e.g. a 3000xxxx number. */
  lineNumber: string;
  /** Customer mobile, e.g. '09121234567'. */
  receptor: string;
  message: string;
}

export type SendSmsResult = { ok: true } | { ok: false; error: string };

interface PayamresanEnvelope {
  Code?: number;
  Message?: string;
}

/** Sends a plain-text SMS through the panel's line. */
export async function sendPayamresanSms(input: SendSmsInput): Promise<SendSmsResult> {
  let envelope: PayamresanEnvelope;
  try {
    const response = await fetch('https://api.payam-resan.com/SendSMS/SendSMS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        UserName: input.username,
        Password: input.password,
        SendDateTime: '',
        SMSMessageText: input.message,
        LineNumber: input.lineNumber,
        Mobiles: [input.receptor],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { ok: false, error: `ارسال پیامک ناموفق بود (HTTP ${response.status}).` };
    }

    envelope = (await response.json().catch(() => ({}))) as PayamresanEnvelope;
  } catch {
    return { ok: false, error: 'ارتباط با سرویس پیامک برقرار نشد.' };
  }

  if (envelope.Code === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    error: `ارسال پیامک ناموفق بود (کد ${envelope.Code ?? '?'}${envelope.Message ? `: ${envelope.Message}` : ''}).`,
  };
}
