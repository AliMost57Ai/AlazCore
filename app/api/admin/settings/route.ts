import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAdmin } from '@/lib/api-auth';
import { GATEWAY_IDS, GATEWAYS } from '@/lib/gateways/registry';
import {
  DEFAULT_SETTINGS,
  FIELD_SPECS,
  getAppSettings,
  saveAppSettings,
  type AppSettings,
  type PanelPatternConfig,
  type PanelPatternKindConfig,
} from '@/lib/settings';
import type { SmsPatternParam } from '@/lib/sms-template';
import { isWidgetAnimation, isWidgetPosition } from '@/lib/support-widget';

/** The SMS panels the admin can activate (lib/order-sms.ts dispatch). */
const SMS_PANEL_IDS = ['mediana', 'smsir', 'melipayamak', 'farazsms', 'payamresan'];

/** Fields that must be https URLs when filled in — a bad URL here would send
 * payment traffic (and its credentials) to the wrong host. */
const URL_FIELDS = new Set<keyof AppSettings>([
  'snapppayBaseUrl',
  'taraRequestUrl',
  'taraVerifyUrl',
  'shahkarBaseUrl',
]);

/** The site-wide sign-in policies (lib/login-method.ts resolves them). */
const LOGIN_POLICIES = ['', 'password', 'twostep', 'otp'];

/** Long free-text template fields. */
const TEMPLATE_FIELDS = new Set<keyof AppSettings>([
  'smsTemplate',
  'smsNoticeTemplate',
  'paymentLinkSmsTemplate',
  'otpSmsTemplate',
]);

/** Fields allowed to be longer than the usual 1000 chars (PEM keys). */
const LONG_TEXT_FIELDS = new Set<keyof AppSettings>(['shahkarPublicKeyPem']);

type ValidationError = { error: NextResponse };
type Validation<T> = { value: T } | ValidationError;

const bad = (message: string): ValidationError => ({
  error: NextResponse.json({ error: message }, { status: 400 }),
});

/** Current payment/SMS panel settings — admin only (values include API keys). */
export async function GET() {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  return NextResponse.json({ settings: await getAppSettings() });
}

/**
 * Pattern parameters: [{ key, value }] — panel field keys mapped to
 * mini-templates. Keys must be sane; values can carry our placeholders.
 */
function parsePatternParams(raw: unknown, label: string): Validation<SmsPatternParam[]> {
  if (!Array.isArray(raw)) {
    return bad(`فهرست ${label} نامعتبر است.`);
  }
  if (raw.length > 20) {
    return bad(`${label} حداکثر می‌تواند ۲۰ پارامتر داشته باشد.`);
  }

  const params: SmsPatternParam[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const key = typeof record.key === 'string' ? record.key.trim() : '';
    const value = typeof record.value === 'string' ? record.value : '';
    if (key === '') {
      continue;
    }
    if (!/^[\w.-]{1,64}$/.test(key)) {
      return bad(`کلید ${label} «${key}» نامعتبر است (حداکثر ۶۴ نویسه لاتین/عدد).`);
    }
    if (value.length > 200) {
      return bad(`مقدار ${label} «${key}» نمی‌تواند بیشتر از ۲۰۰ نویسه باشد.`);
    }
    params.push({ key, value });
  }
  return { value: params };
}

/** One panel-pattern kind: { enabled, code, params }. */
function parsePatternKind(raw: unknown, label: string): Validation<PanelPatternKindConfig> {
  if (typeof raw !== 'object' || raw === null) {
    return bad(`پیکربندی ${label} نامعتبر است.`);
  }
  const record = raw as Record<string, unknown>;
  const enabled = record.enabled === true;
  const code = typeof record.code === 'string' ? record.code.trim() : '';
  if (code.length > 100) {
    return bad(`کد ${label} نمی‌تواند بیشتر از ۱۰۰ نویسه باشد.`);
  }
  if (enabled && code === '') {
    return bad(`برای فعال‌سازی ${label}، کد پترن/قالب آن را وارد کنید.`);
  }

  const params = parsePatternParams(record.params, `${label} — پارامترها`);
  if ('error' in params) {
    return params;
  }
  return { value: { enabled, code, params: params.value } };
}

/** A whole panel-pattern config: { factor, notice, otp, payment_link, pickup_change }. */
function parsePanelPattern(raw: unknown, label: string): Validation<PanelPatternConfig> {
  if (typeof raw !== 'object' || raw === null) {
    return bad(`پیکربندی ${label} نامعتبر است.`);
  }
  const record = raw as Record<string, unknown>;

  const factor = parsePatternKind(record.factor, `${label} — بخش فاکتور`);
  if ('error' in factor) {
    return factor;
  }
  const notice = parsePatternKind(record.notice, `${label} — بخش اطلاع‌رسانی`);
  if ('error' in notice) {
    return notice;
  }
  const otp = parsePatternKind(record.otp, `${label} — بخش کد ورود`);
  if ('error' in otp) {
    return otp;
  }
  const paymentLink = parsePatternKind(record.payment_link, `${label} — بخش لینک پرداخت`);
  if ('error' in paymentLink) {
    return paymentLink;
  }
  // تحویل حضوری: الگوی خاموش/بدون کد = ارسال متنی ساده (اجباری نیست).
  const pickupChange = parsePatternKind(record.pickup_change, `${label} — بخش تحویل حضوری`);
  if ('error' in pickupChange) {
    return pickupChange;
  }
  return {
    value: {
      factor: factor.value,
      notice: notice.value,
      otp: otp.value,
      payment_link: paymentLink.value,
      pickup_change: pickupChange.value,
    },
  };
}

/**
 * Persists payment/SMS panel settings — admin only. The request body is a
 * partial AppSettings object; every field is validated against its spec
 * (lib/settings.ts FIELD_SPECS) so each settings sub-page can submit only
 * its own fields without touching the others.
 */
export async function PUT(request: NextRequest) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const updates: Partial<AppSettings> = {};
  let badResponse: NextResponse | null = null;

  for (const [field, raw] of Object.entries(body)) {
    const key = field as keyof AppSettings;
    const spec = FIELD_SPECS[key];
    if (!spec) {
      badResponse = NextResponse.json(
        { error: `فیلد تنظیمات ناشناخته: ${field}` },
        { status: 400 }
      );
      break;
    }
    const label = spec.label;

    switch (spec.kind) {
      case 'string': {
        if (typeof raw !== 'string') {
          badResponse = bad(`مقدار «${label}» نامعتبر است.`).error;
          break;
        }
        const trimmed = raw.trim();

        if (key === 'zarinpalMerchantId' && trimmed !== '' && !/^[0-9a-fA-F-]{36}$/.test(trimmed)) {
          badResponse = bad('کلید فروشندگی زرین‌پال باید یک شناسه ۳۶ نویسه‌ای معتبر باشد.').error;
          break;
        }
        if (URL_FIELDS.has(key) && trimmed !== '' && !/^https:\/\/\S+$/i.test(trimmed)) {
          badResponse = bad('آدرس سرویس درگاه باید یک URL معتبر با https باشد.').error;
          break;
        }
        if (key === 'medianaSendingNumber' && trimmed !== '' && !/^09\d{9}$/.test(trimmed)) {
          badResponse = bad('شماره خط ارسال پیامک باید با ۰۹ شروع شود و ۱۱ رقم باشد.').error;
          break;
        }
        if (key === 'vibeInstallments' && trimmed !== '' && !/^\d{1,2}$/.test(trimmed)) {
          badResponse = bad('تعداد اقساط وایب باید یک عدد ۱ تا ۲ رقمی باشد.').error;
          break;
        }
        if (key === 'defaultGateway' && trimmed !== '') {
          if (!GATEWAY_IDS.includes(trimmed)) {
            badResponse = bad('درگاه پیش‌فرض انتخاب‌شده شناخته نشد.').error;
            break;
          }
          if (GATEWAYS.find((gateway) => gateway.id === trimmed)?.kind === 'bnpl') {
            badResponse = bad(
              'درگاه اقساطی نمی‌تواند پیش‌فرض باشد — از درگاه‌های آنلاین انتخاب کنید.'
            ).error;
            break;
          }
        }
        if (key === 'activeSmsPanel' && trimmed !== '' && !SMS_PANEL_IDS.includes(trimmed)) {
          badResponse = bad('پنل پیامکی انتخاب‌شده شناخته نشد.').error;
          break;
        }
        if (key === 'loginPolicy' && !LOGIN_POLICIES.includes(trimmed)) {
          badResponse = bad('سیاست ورود انتخاب‌شده شناخته نشد.').error;
          break;
        }
        if (key === 'returnWindowDays' && trimmed !== '') {
          if (!/^\d{1,3}$/.test(trimmed) || Number(trimmed) < 1 || Number(trimmed) > 365) {
            badResponse = bad('مهلت مرجوعی باید عددی بین ۱ تا ۳۶۵ روز باشد.').error;
            break;
          }
        }
        if (
          key === 'returnDefaultShipPayer' &&
          trimmed !== '' &&
          trimmed !== 'customer' &&
          trimmed !== 'shop'
        ) {
          badResponse = bad('پرداخت‌کننده هزینه ارسال برگشت شناخته نشد.').error;
          break;
        }
        if (key === 'shahkarPublicKeyPem' && trimmed !== '' && !trimmed.includes('BEGIN')) {
          badResponse = bad('کلید عمومی شاهکار باید یک فایل PEM معتبر باشد.').error;
          break;
        }
        if (key === 'supportWelcome' && raw.length > 300) {
          badResponse = bad('متن خوش‌آمد نمی‌تواند بیشتر از ۳۰۰ نویسه باشد.').error;
          break;
        }
        if (key === 'supportWidgetPosition' && trimmed !== '' && !isWidgetPosition(trimmed)) {
          badResponse = bad('جای آیکون ویجت شناخته نشد.').error;
          break;
        }
        if (key === 'supportWidgetAnimation' && trimmed !== '' && !isWidgetAnimation(trimmed)) {
          badResponse = bad('انیمیشن ویجت شناخته نشد.').error;
          break;
        }
        // ثانیه‌های ویجت اینجا اعتبارسنجی نمی‌شوند — قاعده‌شان بعد از حلقه است
        // (خالی = پیش‌فرض، و وقتی پشتیبانی خاموش است اصلاً بی‌معنا).
        if (TEMPLATE_FIELDS.has(key)) {
          if (trimmed === '') {
            badResponse = bad('متن پیامک نمی‌تواند خالی باشد.').error;
            break;
          }
          if (raw.length > 1000) {
            badResponse = bad('متن پیامک نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد.').error;
            break;
          }
        } else if (raw.length > (LONG_TEXT_FIELDS.has(key) ? 5000 : 1000)) {
          badResponse = bad(
            `مقدار «${label}» نمی‌تواند بیشتر از ${LONG_TEXT_FIELDS.has(key) ? '۵۰۰۰' : '۱۰۰۰'} نویسه باشد.`
          ).error;
          break;
        }

        (updates as Record<string, unknown>)[field] = raw;
        break;
      }

      case 'boolean': {
        if (typeof raw !== 'boolean') {
          badResponse = bad(`مقدار «${label}» نامعتبر است.`).error;
          break;
        }
        (updates as Record<string, unknown>)[field] = raw;
        break;
      }

      case 'patternParams': {
        const parsed = parsePatternParams(raw, label);
        if ('error' in parsed) {
          badResponse = parsed.error;
          break;
        }
        (updates as Record<string, unknown>)[field] = parsed.value;
        break;
      }

      case 'panelPattern': {
        const parsed = parsePanelPattern(raw, label);
        if ('error' in parsed) {
          badResponse = parsed.error;
          break;
        }
        (updates as Record<string, unknown>)[field] = parsed.value;
        break;
      }

      case 'stringList': {
        if (
          !Array.isArray(raw) ||
          raw.length > 30 ||
          raw.some((item) => typeof item !== 'string')
        ) {
          badResponse = bad(`فهرست «${label}» نامعتبر است.`).error;
          break;
        }
        if (key === 'activeGateways') {
          const unknown = raw.find((item) => !GATEWAY_IDS.includes(item as string));
          if (unknown !== undefined) {
            badResponse = bad(`درگاه «${unknown}» شناخته نشد.`).error;
            break;
          }
        }
        (updates as Record<string, unknown>)[field] = [...new Set(raw as string[])];
        break;
      }
    }

    if (badResponse) {
      break;
    }
  }

  if (badResponse) {
    return badResponse;
  }

  const stored = await getAppSettings();

  // ثانیه‌های ویجت پشتیبانی — خالی = پیش‌فرض مرجع ('0' تأخیر / '8' حباب)، و
  // اعتبارسنجی عددی فقط وقتی معنا دارد که پشتیبانی روشن است (در همین درخواست
  // یا ذخیره قبلی): با پشتیبانی خاموش این دو مقدار هیچ اثری ندارند و نباید
  // ذخیره را بلاک کنند.
  const supportEnabled = updates.supportEnabled ?? stored.supportEnabled;
  for (const [field, fallback] of [
    ['supportWidgetDelay', DEFAULT_SETTINGS.supportWidgetDelay],
    ['supportWidgetNoticeSeconds', DEFAULT_SETTINGS.supportWidgetNoticeSeconds],
  ] as const) {
    const value = updates[field];
    if (value === undefined) {
      continue;
    }
    if (value.trim() === '') {
      (updates as Record<string, unknown>)[field] = fallback;
      continue;
    }
    if (supportEnabled && !/^\d{1,3}$/.test(value.trim())) {
      return bad('مقدار ثانیه باید عددی حداکثر سه‌رقمی باشد.').error;
    }
  }

  // Enabling a Mediana pattern send without a code would break every payment
  // SMS — the code may come in this request or already be stored.
  if (updates.smsUsePattern === true) {
    const effectiveCode = updates.medianaPatternCode ?? stored.medianaPatternCode;
    if (effectiveCode.trim() === '') {
      return bad('برای فعال‌سازی ارسال با فرمت ، کد پترنی مدیانا را وارد کنید.').error;
    }
  }
  if (updates.smsNoticeUsePattern === true) {
    const effectiveCode = updates.medianaNoticePatternCode ?? stored.medianaNoticePatternCode;
    if (effectiveCode.trim() === '') {
      return bad('برای فعال‌سازی اطلاع‌رسانی با فرمت ، کد پترنی مدیانا را وارد کنید.').error;
    }
  }
  if (updates.medianaOtpUsePattern === true) {
    const effectiveCode = updates.medianaOtpPatternCode ?? stored.medianaOtpPatternCode;
    if (effectiveCode.trim() === '') {
      return bad('برای فعال‌سازی کد ورود با فرمت ، کد پترنی مدیانا را وارد کنید.').error;
    }
  }
  if (updates.paymentLinkUsePattern === true) {
    const effectiveCode =
      updates.medianaPaymentLinkPatternCode ?? stored.medianaPaymentLinkPatternCode;
    if (effectiveCode.trim() === '') {
      return bad('برای فعال‌سازی لینک پرداخت با فرمت ، کد پترنی مدیانا را وارد کنید.').error;
    }
  }
  // The default gateway only makes sense as one of the active ones.
  if (
    updates.defaultGateway &&
    updates.defaultGateway !== '' &&
    Array.isArray(updates.activeGateways) &&
    updates.activeGateways.length > 0 &&
    !updates.activeGateways.includes(updates.defaultGateway)
  ) {
    return bad('درگاه پیش‌فرض باید یکی از درگاه‌های فعال باشد.').error;
  }

  const settings = await saveAppSettings(updates);
  return NextResponse.json({ ok: true, settings });
}
