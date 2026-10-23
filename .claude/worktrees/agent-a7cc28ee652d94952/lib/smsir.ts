/**
 * sms.ir SMS provider (https://sms.ir), per the platform's v1 API.
 *
 * Base URL https://api.sms.ir, authentication through the X-API-KEY header.
 * Two send methods are used:
 *
 *  - Normal SMS: POST /v1/send/bulk with { lineNumber, messageText,
 *    mobiles: [receptor] } — the panel's service line sends the rendered
 *    template text.
 *
 *  - Pattern SMS: POST /v1/send/verify with { mobile, templateId,
 *    parameters: [{name, value}] } — the template and its parameter names are
 *    defined in the sms.ir panel; our config maps each name to a value
 *    (placeholder template).
 *
 * Success = HTTP 200 with status 1.
 */

const REQUEST_TIMEOUT_MS = 20_000;

export interface SendSmsInput {
  apiKey: string;
  /** The panel's sending line, e.g. a 3000xxxx number. */
  lineNumber: string;
  /** Customer mobile, e.g. '09121234567'. */
  receptor: string;
  message: string;
}

export interface SendPatternSmsInput {
  apiKey: string;
  /** Customer mobile, e.g. '09121234567'. */
  mobile: string;
  /** Template id defined in the sms.ir panel. */
  templateId: string;
  /** Values for the template's parameters, keyed by the panel field name. */
  parameters: Record<string, string>;
}

export type SendSmsResult = { ok: true } | { ok: false; error: string };

interface SmsirEnvelope {
  status?: number;
  message?: string;
}

async function postSmsir(
  path: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<SendSmsResult> {
  let envelope: SmsirEnvelope;
  try {
    const response = await fetch(`https://api.sms.ir${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { ok: false, error: `ارسال پیامک ناموفق بود (HTTP ${response.status}).` };
    }

    envelope = (await response.json().catch(() => ({}))) as SmsirEnvelope;
  } catch {
    return { ok: false, error: 'ارتباط با سرویس پیامک برقرار نشد.' };
  }

  if (envelope.status === 1) {
    return { ok: true };
  }

  return {
    ok: false,
    error: `ارسال پیامک ناموفق بود (کد ${envelope.status ?? '?'}${envelope.message ? `: ${envelope.message}` : ''}).`,
  };
}

/** Sends a plain-text SMS through the panel's line. */
export async function sendSmsirSms(input: SendSmsInput): Promise<SendSmsResult> {
  return postSmsir('/v1/send/bulk', input.apiKey, {
    lineNumber: input.lineNumber,
    messageText: input.message,
    mobiles: [input.receptor],
  });
}

/** Sends an SMS through a verify-template defined in the sms.ir panel. */
export async function sendSmsirPatternSms(input: SendPatternSmsInput): Promise<SendSmsResult> {
  return postSmsir('/v1/send/verify', input.apiKey, {
    mobile: input.mobile,
    templateId: input.templateId,
    parameters: Object.entries(input.parameters).map(([name, value]) => ({ name, value })),
  });
}
