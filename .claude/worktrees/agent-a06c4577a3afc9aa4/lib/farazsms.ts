/**
 * FarazSMS (IPPanel) SMS provider, per https://docs.ippanel.com/ — the Edge
 * API.
 *
 * Base URL https://edge.ippanel.com/v1/api/send, authentication through the
 * Authorization header carrying the raw API key. Two sending_type modes are
 * used:
 *
 *  - Normal SMS (webservice): { sending_type: 'webservice', from_number,
 *    message, params: { recipients: [receptor] } } — the panel's line sends
 *    the rendered template text.
 *
 *  - Pattern SMS: { sending_type: 'pattern', from_number, code,
 *    recipients: [receptor] (exactly one), params: {…} } — the pattern and
 *    its parameter keys are defined in the FarazSMS panel; our config maps
 *    each key to a value (placeholder template).
 *
 * Success = HTTP 200 with meta.status true (message_code '200-1'). Failures
 * carry meta.message / message_code (e.g. credit or pattern errors).
 */

const REQUEST_TIMEOUT_MS = 20_000;

export interface SendSmsInput {
  apiKey: string;
  /** The panel's sending line, e.g. a +98xxx or 3000xxx number. */
  lineNumber: string;
  /** Customer mobile, e.g. '09121234567'. */
  receptor: string;
  message: string;
}

export interface SendPatternSmsInput {
  apiKey: string;
  /** The panel's sending line, e.g. a +98xxx or 3000xxx number. */
  lineNumber: string;
  /** Customer mobile, e.g. '09121234567'. */
  receptor: string;
  /** Pattern code defined in the FarazSMS panel. */
  patternCode: string;
  /** Values for the pattern's parameters, keyed by the panel field key. */
  parameters: Record<string, string>;
}

export type SendSmsResult = { ok: true } | { ok: false; error: string };

interface FarazEnvelope {
  meta?: { status?: boolean; message?: string; message_code?: string };
  data?: unknown;
}

async function postFaraz(apiKey: string, body: Record<string, unknown>): Promise<SendSmsResult> {
  let envelope: FarazEnvelope;
  try {
    const response = await fetch('https://edge.ippanel.com/v1/api/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { ok: false, error: `ارسال پیامک ناموفق بود (HTTP ${response.status}).` };
    }

    envelope = (await response.json().catch(() => ({}))) as FarazEnvelope;
  } catch {
    return { ok: false, error: 'ارتباط با سرویس پیامک برقرار نشد.' };
  }

  if (envelope.meta?.status === true || envelope.meta?.message_code === '200-1') {
    return { ok: true };
  }

  const code = envelope.meta?.message_code ?? '?';
  const reason = envelope.meta?.message ?? '';
  return {
    ok: false,
    error: `ارسال پیامک ناموفق بود (کد ${code}${reason ? `: ${reason}` : ''}).`,
  };
}

/** Sends a plain-text SMS through the panel's line. */
export async function sendFarazsmsSms(input: SendSmsInput): Promise<SendSmsResult> {
  return postFaraz(input.apiKey, {
    sending_type: 'webservice',
    from_number: input.lineNumber,
    message: input.message,
    params: { recipients: [input.receptor] },
  });
}

/** Sends an SMS through a pattern defined in the FarazSMS panel. */
export async function sendFarazsmsPatternSms(input: SendPatternSmsInput): Promise<SendSmsResult> {
  return postFaraz(input.apiKey, {
    sending_type: 'pattern',
    from_number: input.lineNumber,
    code: input.patternCode,
    recipients: [input.receptor],
    params: input.parameters,
  });
}
