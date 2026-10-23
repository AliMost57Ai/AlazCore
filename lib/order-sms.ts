/**
 * Server-side order SMS: the payment factor sent when an order is paid, and
 * the shipping notice sent when an admin posts an order. The active panel
 * (تنظیمات → پنل پیامکی) does the sending — Mediana (the default), sms.ir,
 * Melipayamak, FarazSMS or Payam-Resan — each picking its configured send
 * mode (plain template text, or the panel's own pattern/verify template) and
 * rendering the shared placeholders.
 */

import { TIPAX_NOTE } from './constants';
import { licensedSmsIds } from './core-license';
import prisma from './db';
import { sendFarazsmsPatternSms, sendFarazsmsSms } from './farazsms';
import { faNumber } from './format';
import { sendMedianaPatternSms, sendMedianaSms } from './mediana';
import { sendMelipayamakSms } from './melipayamak';
import { sendPayamresanSms } from './payamresan';
import { getAppSettings, type AppSettings, type PanelPatternKindConfig } from './settings';
import { renderSmsTemplate, type SmsTemplateValues } from './sms-template';
import { sendSmsirPatternSms, sendSmsirSms } from './smsir';
import { logSystemError } from './system-logs';

export interface NoticeSmsInput {
  order: {
    displayId: string;
    amount: number;
    date: string;
    paymentRefId: string | null;
    trackingCode: string | null;
    userId: string | null;
  };
  /** Optional override; otherwise resolved from the order's user. */
  receptor?: string;
}

/** Shared placeholder values for both SMS kinds. */
function smsValues(order: NoticeSmsInput['order'], refId: string): SmsTemplateValues {
  return {
    order: order.displayId,
    amount: `${faNumber(order.amount)} تومان`,
    refId,
    delivery: TIPAX_NOTE,
    date: order.date,
    tracking: order.trackingCode ?? '',
  };
}

type SendResult = { ok: true } | { ok: false; error: string };

/** Renders a pattern config's parameter mini-templates against the values. */
function patternParams(
  params: PanelPatternKindConfig['params'],
  values: SmsTemplateValues
): Record<string, string> {
  return Object.fromEntries(
    params.map((param) => [param.key, renderSmsTemplate(param.value, values)])
  );
}

/**
 * Sends one order SMS through the active panel. `kind` picks the factor,
 * notice, payment-link or OTP text of each panel; plain sends use the shared
 * general templates (الگوهای پیامکی). Failures are recorded in the system log
 * with the panel's own error text so the admin can see what the API actually
 * said.
 */
async function sendViaPanel(
  settings: AppSettings,
  receptor: string,
  values: SmsTemplateValues,
  kind: 'factor' | 'notice' | 'payment_link' | 'otp' | 'pickup_change'
): Promise<SendResult> {
  // پنل پیامکی مجازِ پلن Core برای این دامنه (بند ۲-۸): پنل تنظیم‌شده‌ی ادمین
  // فقط وقتی به‌کار می‌رود که Core آن را برای دامنه فعال کرده باشد؛ وگرنه
  // اولین پنل مجازِ پیکربندی‌شده. هیچ پنل مجازی آماده نباشد، پیامک بی‌خطر
  // رد می‌شود (سفارش نباید بخواند) و در لاگ سیستمی ثبت می‌شود.
  let panel = settings.activeSmsPanel || 'mediana';
  const licensed = await licensedSmsIds();
  if (licensed && !licensed.has(panel)) {
    const configured = (
      ['mediana', 'smsir', 'melipayamak', 'payamresan', 'farazsms'] as const
    ).find((candidate) => licensed.has(candidate) && panelIsReady(settings, candidate));
    if (!configured) {
      await logSystemError({
        kind: 'sms',
        provider: panel,
        action: kind,
        message: 'پنل پیامکی توسط سامانه Core برای این سایت فعال نشده است.',
      });
      return { ok: false, error: 'پنل پیامکی فعال نیست.' };
    }
    panel = configured;
  }
  const result = await dispatchViaPanel(settings, panel, receptor, values, kind);
  if (!result.ok) {
    await logSystemError({
      kind: 'sms',
      provider: panel,
      action: kind,
      message: result.error,
    });
  }
  return result;
}

/** آمادگی اعتباری هر پنل — همان شرط‌های dispatchViaPanel، برای انتخاب جایگزین مجاز. */
function panelIsReady(settings: AppSettings, panel: string): boolean {
  switch (panel) {
    case 'smsir':
      return Boolean(settings.smsirApiKey);
    case 'melipayamak':
      return Boolean(settings.melipayamakUsername && settings.melipayamakPassword);
    case 'farazsms':
      return Boolean(settings.farazsmsApiKey);
    case 'payamresan':
      return Boolean(settings.payamresanUsername && settings.payamresanPassword);
    case 'mediana':
    default:
      return Boolean(settings.medianaApiKey);
  }
}

async function dispatchViaPanel(
  settings: AppSettings,
  panel: string,
  receptor: string,
  values: SmsTemplateValues,
  kind: 'factor' | 'notice' | 'payment_link' | 'otp' | 'pickup_change'
): Promise<SendResult> {
  const plainText = renderSmsTemplate(
    kind === 'factor'
      ? settings.smsTemplate
      : kind === 'notice'
        ? settings.smsNoticeTemplate
        : kind === 'otp'
          ? settings.otpSmsTemplate
          : kind === 'pickup_change'
            ? settings.smsPickupChangeTemplate
            : settings.paymentLinkSmsTemplate,
    values
  );

  switch (panel) {
    case 'smsir': {
      if (!settings.smsirApiKey) {
        return { ok: false, error: 'پنل پیامک sms.ir پیکربندی نشده است.' };
      }
      const config = settings.smsirPatternConfig[kind];
      if (config.enabled && config.code) {
        return sendSmsirPatternSms({
          apiKey: settings.smsirApiKey,
          mobile: receptor,
          templateId: config.code,
          parameters: patternParams(config.params, values),
        });
      }
      return sendSmsirSms({
        apiKey: settings.smsirApiKey,
        lineNumber: settings.smsirLineNumber,
        receptor,
        message: plainText,
      });
    }

    case 'melipayamak': {
      if (!(settings.melipayamakUsername && settings.melipayamakPassword)) {
        return { ok: false, error: 'پنل پیامک ملی‌پیامک پیکربندی نشده است.' };
      }
      return sendMelipayamakSms({
        username: settings.melipayamakUsername,
        password: settings.melipayamakPassword,
        lineNumber: settings.melipayamakLineNumber,
        receptor,
        message: plainText,
      });
    }

    case 'farazsms': {
      if (!settings.farazsmsApiKey) {
        return { ok: false, error: 'پنل پیامک فراز اس‌ام‌اس پیکربندی نشده است.' };
      }
      const config = settings.farazPatternConfig[kind];
      if (config.enabled && config.code) {
        return sendFarazsmsPatternSms({
          apiKey: settings.farazsmsApiKey,
          lineNumber: settings.farazsmsLineNumber,
          receptor,
          patternCode: config.code,
          parameters: patternParams(config.params, values),
        });
      }
      return sendFarazsmsSms({
        apiKey: settings.farazsmsApiKey,
        lineNumber: settings.farazsmsLineNumber,
        receptor,
        message: plainText,
      });
    }

    case 'payamresan': {
      if (!(settings.payamresanUsername && settings.payamresanPassword)) {
        return { ok: false, error: 'پنل پیامک پیام رسان پیکربندی نشده است.' };
      }
      return sendPayamresanSms({
        username: settings.payamresanUsername,
        password: settings.payamresanPassword,
        lineNumber: settings.payamresanLineNumber,
        receptor,
        message: plainText,
      });
    }

    case 'mediana':
    default: {
      if (!settings.medianaApiKey) {
        return { ok: false, error: 'پنل پیامک مدیانا پیکربندی نشده است.' };
      }
      const sendingNumber = settings.medianaSendingNumber || undefined;
      if (kind === 'factor' && settings.smsUsePattern && settings.medianaPatternCode) {
        return sendMedianaPatternSms({
          apiKey: settings.medianaApiKey,
          sendingNumber,
          receptor,
          patternCode: settings.medianaPatternCode,
          parameters: patternParams(settings.medianaPatternParams, values),
        });
      }
      if (kind === 'notice' && settings.smsNoticeUsePattern && settings.medianaNoticePatternCode) {
        return sendMedianaPatternSms({
          apiKey: settings.medianaApiKey,
          sendingNumber,
          receptor,
          patternCode: settings.medianaNoticePatternCode,
          parameters: patternParams(settings.medianaNoticePatternParams, values),
        });
      }
      if (kind === 'otp' && settings.medianaOtpUsePattern && settings.medianaOtpPatternCode) {
        return sendMedianaPatternSms({
          apiKey: settings.medianaApiKey,
          sendingNumber,
          receptor,
          patternCode: settings.medianaOtpPatternCode,
          parameters: patternParams(settings.medianaOtpPatternParams, values),
        });
      }
      if (
        kind === 'payment_link' &&
        settings.paymentLinkUsePattern &&
        settings.medianaPaymentLinkPatternCode
      ) {
        return sendMedianaPatternSms({
          apiKey: settings.medianaApiKey,
          sendingNumber,
          receptor,
          patternCode: settings.medianaPaymentLinkPatternCode,
          parameters: patternParams(settings.medianaPaymentLinkPatternParams, values),
        });
      }
      return sendMedianaSms({
        apiKey: settings.medianaApiKey,
        sendingNumber,
        receptor,
        message: plainText,
      });
    }
  }
}

/** Resolves the customer's mobile from the order's user, if needed. */
async function resolveReceptor(input: NoticeSmsInput): Promise<string | null> {
  let receptor = input.receptor ?? null;
  if (!receptor && input.order.userId) {
    const user = await prisma.user.findUnique({
      where: { id: input.order.userId },
      select: { phone: true },
    });
    receptor = user?.phone ?? null;
  }
  return receptor;
}

/**
 * Sends the payment-factor SMS for a just-paid order — from the wallet, or
 * from the gateway callback. SMS failure must never fail the payment itself,
 * so errors are returned (and logged by the caller), not thrown.
 */
export async function sendOrderFactorSms(
  input: NoticeSmsInput & { refId: string | null }
): Promise<SendResult> {
  const settings = await getAppSettings();
  if (!settings.smsFactorEnabled) {
    return { ok: false, error: 'پیامک فاکتور در صفحه «الگوهای پیامکی» غیرفعال است.' };
  }
  const receptor = await resolveReceptor(input);
  if (!receptor) {
    return { ok: false, error: 'شماره موبایل مشتری در دسترس نیست.' };
  }

  return sendViaPanel(settings, receptor, smsValues(input.order, input.refId ?? ''), 'factor');
}

/**
 * Sends the shipping-notice SMS for a posted order. Returns ok:false with a
 * Persian error when the panel isn't configured, the customer's phone is
 * unavailable, or the panel rejects the send.
 */
export async function sendOrderNoticeSms(input: NoticeSmsInput): Promise<SendResult> {
  const settings = await getAppSettings();
  if (!settings.smsNoticeEnabled) {
    return { ok: false, error: 'پیامک اطلاع‌رسانی ارسال در صفحه «الگوهای پیامکی» غیرفعال است.' };
  }
  const receptor = await resolveReceptor(input);
  if (!receptor) {
    return { ok: false, error: 'شماره موبایل مشتری در دسترس نیست.' };
  }

  return sendViaPanel(
    settings,
    receptor,
    smsValues(input.order, input.order.paymentRefId ?? ''),
    'notice'
  );
}

/**
 * پیامک «تغییر برنامه تحویل حضوری» — وقتی مالک تاریخ/بازه تحویل را از لیست
 * تحویل حضوری عوض می‌کند و دکمه اطلاع‌رسانی را می‌زند. متن از الگوی
 * smsPickupChangeTemplate (جاهای خالی: {order} {date} {time} {reason}).
 */
export async function sendPickupScheduleSms(input: {
  order: NoticeSmsInput['order'];
  /** برنامه جدید — برچسب جلالی روز و بازه زمانی. */
  schedule: { date: string; time: string };
  /** علت تغییر (اختیاری — در الگو با {reason} می‌آید). */
  reason?: string;
  receptor?: string;
}): Promise<SendResult> {
  const settings = await getAppSettings();
  if (!settings.smsPickupChangeEnabled) {
    return { ok: false, error: 'پیامک تغییر تحویل حضوری در «الگوهای پیامکی» غیرفعال است.' };
  }
  const receptor = await resolveReceptor(input);
  if (!receptor) {
    return { ok: false, error: 'شماره موبایل مشتری در دسترس نیست.' };
  }

  return sendViaPanel(
    settings,
    receptor,
    {
      ...smsValues(input.order, input.order.paymentRefId ?? ''),
      date: input.schedule.date,
      time: input.schedule.time,
      reason: input.reason ?? '',
    },
    'pickup_change'
  );
}

/**
 * Sends the shareable payment-link SMS to an arbitrary mobile (the person the
 * customer wants to pay on their behalf). The link text is the admin's
 * paymentLinkSmsTemplate with {link} and the order placeholders rendered.
 */
export async function sendPaymentLinkSms(input: {
  receptor: string;
  order: NoticeSmsInput['order'];
  link: string;
}): Promise<SendResult> {
  const settings = await getAppSettings();
  if (!settings.paymentLinkSmsEnabled) {
    return { ok: false, error: 'پیامک لینک پرداخت در صفحه «الگوهای پیامکی» غیرفعال است.' };
  }
  return sendViaPanel(
    settings,
    input.receptor,
    {
      ...smsValues(input.order, ''),
      link: input.link,
    },
    'payment_link'
  );
}

/**
 * Sends the login one-time-code SMS (کد ورود) — the second step of a
 * two-step/OTP sign-in. Only {code} (and {date}) carry meaning here; the
 * order placeholders are empty strings so an admin's template that mentions
 * them renders nothing odd. Pattern setups use whatever the admin mapped.
 */
export async function sendLoginOtpSms(receptor: string, code: string): Promise<SendResult> {
  const settings = await getAppSettings();
  if (!settings.otpSmsEnabled) {
    return {
      ok: false,
      error:
        'پیامک کد ورود در صفحه «الگوهای پیامکی» غیرفعال است — کاربران دو مرحله‌ای نمی‌توانند کد دریافت کنند.',
    };
  }
  return sendViaPanel(
    settings,
    receptor,
    { order: '', amount: '', refId: '', delivery: '', date: '', tracking: '', code },
    'otp'
  );
}
