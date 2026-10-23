/**
 * Mediana SMS provider, per https://developer.mediana.ir/.
 *
 * Base URL https://api.mediana.ir, authentication through the X-API-KEY
 * header. Two send methods are used:
 *
 *  - Normal SMS: POST /sms/v1/send/sms with either
 *    { type: 'Informational', recipients, messageText } (panel service line)
 *    or { sendingNumber, recipients, messageText } (dedicated line).
 *
 *  - Pattern SMS: POST /sms/v1/send/pattern with { patternCode, recipients
 *    (max 1), parameters } plus the same sendingNumber/type choice. The
 *    pattern text and its parameter keys are defined in the Mediana panel;
 *    our config maps each parameter key to a value (placeholder template).
 *
 * Success = HTTP 200 with data.Succeed true. Failures carry a meta error
 * code (e.g. 1042 = insufficient wallet balance).
 */

const REQUEST_TIMEOUT_MS = 20_000;

export interface SendSmsInput {
  apiKey: string;
  /** Optional dedicated sending number; omit to use the Informational line. */
  sendingNumber?: string;
  /** Customer mobile, e.g. '09121234567'. */
  receptor: string;
  message: string;
}

export interface SendPatternSmsInput {
  apiKey: string;
  /** Optional dedicated sending number; omit to use the Informational line. */
  sendingNumber?: string;
  receptor: string;
  /** Pattern code defined in the Mediana panel. */
  patternCode: string;
  /** Values for the pattern's parameters, keyed by the panel field key. */
  parameters: Record<string, string>;
}

export type SendSmsResult = { ok: true } | { ok: false; error: string };

interface MedianaEnvelope {
  meta?: { code?: string; errorMessage?: string | null };
  data?: { Succeed?: boolean; Message?: string };
}

async function postMediana(
  path: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<SendSmsResult> {
  let envelope: MedianaEnvelope;
  try {
    const response = await fetch(`https://api.mediana.ir${path}`, {
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

    envelope = (await response.json()) as MedianaEnvelope;
  } catch {
    return { ok: false, error: 'ارتباط با سرویس پیامک برقرار نشد.' };
  }

  if (envelope.data?.Succeed) {
    return { ok: true };
  }

  const code = envelope.meta?.code ?? '?';
  const reason = envelope.meta?.errorMessage ?? envelope.data?.Message ?? '';
  return {
    ok: false,
    error: `ارسال پیامک ناموفق بود (کد ${code}${reason ? `: ${reason}` : ''}).`,
  };
}

/** Sends a plain-text SMS. */
export async function sendMedianaSms(input: SendSmsInput): Promise<SendSmsResult> {
  return postMediana('/sms/v1/send/sms', input.apiKey, {
    ...(input.sendingNumber ? { sendingNumber: input.sendingNumber } : { type: 'Informational' }),
    recipients: [input.receptor],
    messageText: input.message,
  });
}

/** Sends an SMS through a pattern defined in the Mediana panel. */
export async function sendMedianaPatternSms(input: SendPatternSmsInput): Promise<SendSmsResult> {
  return postMediana('/sms/v1/send/pattern', input.apiKey, {
    ...(input.sendingNumber ? { sendingNumber: input.sendingNumber } : { type: 'Informational' }),
    recipients: [input.receptor],
    patternCode: input.patternCode,
    parameters: input.parameters,
  });
}
