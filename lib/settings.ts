/**
 * Panel settings (payment gateways, SMS providers, active-gateway selection)
 * stored in the AppConfig key-value table and edited from the admin sub-pages
 * of تنظیمات: /settings/payment (درگاه پرداخت), /settings/bnpl (درگاه اقساطی),
 * /settings/sms (پنل پیامک), /settings/sms-templates (الگوهای پیامکی).
 *
 * Secrets live in the DB, which is fine for this template's trust model
 * (data/app.db is gitignored and only reachable from the server runtime).
 * Values are never sent to the browser — the admin form receives them only
 * through the admin-only API route.
 *
 * Storage is data-driven: every field of AppSettings has one spec entry in
 * FIELD_SPECS (DB key + kind), so getAppSettings/saveAppSettings stay generic
 * as the field list grows with each new gateway or SMS panel.
 */

import prisma from './db';
import {
  DEFAULT_OTP_TEMPLATE,
  DEFAULT_PAYMENT_LINK_TEMPLATE,
  DEFAULT_SMS_NOTICE_TEMPLATE,
  DEFAULT_SMS_PICKUP_CHANGE_TEMPLATE,
  DEFAULT_SMS_TEMPLATE,
  type SmsPatternParam,
} from './sms-template';

/** One kind config of a panel's pattern setup (factor / notice / login OTP). */
export interface PanelPatternKindConfig {
  enabled: boolean;
  /** Pattern (Mediana/FarazSMS) or template (sms.ir) code from the panel. */
  code: string;
  /** Panel parameter key → mini-template value. */
  params: SmsPatternParam[];
}

/** A panel's complete pattern setup. */
export interface PanelPatternConfig {
  factor: PanelPatternKindConfig;
  notice: PanelPatternKindConfig;
  otp: PanelPatternKindConfig;
  payment_link: PanelPatternKindConfig;
  /** تغییر برنامه تحویل حضوری — پیامک اطلاع‌رسانی لیست تحویل حضوری. */
  pickup_change: PanelPatternKindConfig;
}

const EMPTY_PATTERN_KIND: PanelPatternKindConfig = { enabled: false, code: '', params: [] };

export const EMPTY_PANEL_PATTERN_CONFIG: PanelPatternConfig = {
  factor: EMPTY_PATTERN_KIND,
  notice: EMPTY_PATTERN_KIND,
  otp: EMPTY_PATTERN_KIND,
  payment_link: EMPTY_PATTERN_KIND,
  pickup_change: EMPTY_PATTERN_KIND,
};

export interface AppSettings {
  // --- انتخاب درگاه‌ها / پنل فعال -------------------------------------
  /** Gateway ids the admin activated (online IPG + BNPL). Empty = all ready. */
  activeGateways: string[];
  /** The gateway preselected at checkout. Empty = zarinpal (or first active). */
  defaultGateway: string;
  /** Which SMS panel sends the order messages. Empty = mediana. */
  activeSmsPanel: string;

  // --- درگاه پرداخت آنلاین (IPG) -------------------------------------
  /** ZarinPal merchant ID (36-character UUID from the panel). */
  zarinpalMerchantId: string;
  /** Route payments through sandbox.zarinpal.com instead of the live gateway. */
  zarinpalSandbox: boolean;
  /** IdPay API key (X-API-KEY header). */
  idpayApiKey: string;
  /** Route IdPay requests through the sandbox header. */
  idpaySandbox: boolean;
  /** Parsian (PEC) LoginAccount PIN. */
  parsianPin: string;
  /** Mellat (BPM) terminal credentials. */
  mellatTerminalId: string;
  mellatUsername: string;
  mellatPassword: string;
  /** Saman (SEP) terminal id. */
  samanTerminalId: string;
  /** Sadad credentials — the terminal key is the base64 3DES signing key. */
  sadadMerchantId: string;
  sadadTerminalId: string;
  sadadTerminalKey: string;
  /** Sepah (OmidPay) credentials. */
  sepahMerchantId: string;
  sepahTerminalId: string;
  sepahPassword: string;
  /** SizPay credentials — two base64 AES secrets plus the HMAC sign key. */
  sizpayMerchantId: string;
  sizpayTerminalId: string;
  sizpaySecretKey1: string;
  sizpaySecretKey2: string;
  sizpayDigitalSign: string;
  /** Pasargad (PEP) credentials — username is the IPG code, password the merchant code. */
  pasargadUsername: string;
  pasargadPassword: string;
  pasargadTerminalCode: string;

  // --- درگاه اقساطی (BNPL) --------------------------------------------
  /** DigiPay API username/password (from the merchant panel). */
  digipayUsername: string;
  digipayPassword: string;
  /** Route DigiPay payments through uat.mydigipay.info (staging). */
  digipaySandbox: boolean;
  /** SnappPay API credentials (portal.snapppay.ir → توسعه فنی → دسترسی‌های فنی). */
  snapppayClientId: string;
  snapppayClientSecret: string;
  snapppayUsername: string;
  snapppayPassword: string;
  /** Custom base URL for the SnappPay API (default: production). */
  snapppayBaseUrl: string;
  /** Tara gateway credentials — no public API docs, so the endpoint is admin-supplied. */
  taraApiKey: string;
  /** Tara payment-request endpoint URL (from the contract with the provider). */
  taraRequestUrl: string;
  /** Tara verification endpoint URL. */
  taraVerifyUrl: string;
  /** Vibe API key (X-API-Key header) + the installment count from the contract. */
  vibeApiKey: string;
  vibeInstallments: string;
  /** Keepa credentials (client pair + terminal). */
  keepaClientId: string;
  keepaClientSecret: string;
  keepaTerminalId: string;
  /** MiniPay merchant token (merchant_id field). */
  minipayMerchantId: string;
  /** Fakher (FakherSep) credentials — national code + terminal number. */
  fakherNationalCode: string;
  fakherTerminalNumber: string;

  // --- پنل‌های پیامک ---------------------------------------------------
  /** Mediana API key (sent as the X-API-KEY header). */
  medianaApiKey: string;
  /** Optional dedicated sending number; empty = send via the 'Informational' line. */
  medianaSendingNumber: string;
  /** sms.ir API key (X-API-KEY) + the panel's sending line. */
  smsirApiKey: string;
  smsirLineNumber: string;
  /** sms.ir pattern/template setup (factor + notice). */
  smsirPatternConfig: PanelPatternConfig;
  /** Melipayamak classic REST credentials (username, password, sender line). */
  melipayamakUsername: string;
  melipayamakPassword: string;
  melipayamakLineNumber: string;
  /** FarazSMS (IPPanel) API key (Authorization header) + sender line. */
  farazsmsApiKey: string;
  farazsmsLineNumber: string;
  /** FarazSMS pattern setup (factor + notice). */
  farazPatternConfig: PanelPatternConfig;
  /** Payam-Resan credentials. */
  payamresanUsername: string;
  payamresanPassword: string;
  payamresanLineNumber: string;

  // --- الگوهای پیامکی --------------------------------------------------
  /** Whether the after-payment factor SMS is sent at all (الگو فعال است؟). */
  smsFactorEnabled: boolean;
  /** After-payment SMS text with {order}/{amount}/… placeholders. */
  smsTemplate: string;
  /** Send via the Mediana pattern endpoint instead of a plain text SMS. */
  smsUsePattern: boolean;
  /** Pattern code defined in the Mediana panel. */
  medianaPatternCode: string;
  /** Pattern parameters: Mediana panel field key → mini-template value. */
  medianaPatternParams: SmsPatternParam[];
  /** Whether the shipping-notice SMS is sent at all (الگو فعال است؟). */
  smsNoticeEnabled: boolean;
  /** Shipping-notice SMS text (sent when the order is posted). */
  smsNoticeTemplate: string;
  /** Whether the pickup schedule-change SMS is sent (الگوی تغییر تحویل حضوری). */
  smsPickupChangeEnabled: boolean;
  /** Pickup schedule-change SMS text — {order} {date} {time} {reason} placeholders. */
  smsPickupChangeTemplate: string;
  /** Send the shipping notice through a Mediana pattern. */
  smsNoticeUsePattern: boolean;
  /** Mediana pattern code for the shipping-notice SMS. */
  medianaNoticePatternCode: string;
  /** Parameters for the notice pattern: panel field key → mini-template. */
  medianaNoticePatternParams: SmsPatternParam[];
  /** Whether the payment-link SMS is sent at all (الگو فعال است؟). */
  paymentLinkSmsEnabled: boolean;
  /** Payment-link SMS text — sent when a customer shares the pay link. */
  paymentLinkSmsTemplate: string;
  /** Send the payment-link SMS through a Mediana pattern. */
  paymentLinkUsePattern: boolean;
  /** Mediana pattern code for the payment-link SMS. */
  medianaPaymentLinkPatternCode: string;
  /** Parameters for the payment-link Mediana pattern. */
  medianaPaymentLinkPatternParams: SmsPatternParam[];
  /** Whether the login-OTP SMS is sent at all (الگو فعال است؟). */
  otpSmsEnabled: boolean;
  /** Login one-time-code SMS text — sent at the OTP/two-step login step. */
  otpSmsTemplate: string;
  /** Send the login OTP via the Mediana pattern endpoint. */
  medianaOtpUsePattern: boolean;
  /** Mediana pattern code for the login OTP SMS. */
  medianaOtpPatternCode: string;
  /** Parameters for the login OTP Mediana pattern. */
  medianaOtpPatternParams: SmsPatternParam[];

  // --- سیاست ورود --------------------------------------------------------
  /** Site-wide sign-in policy: '' (users choose) | 'password' | 'twostep' | 'otp'. */
  loginPolicy: string;

  // --- شاهکار (تطبیق موبایل و کد ملی) ------------------------------------
  /** Require a successful Shahkar phone↔national-id match at signup. */
  shahkarEnabled: boolean;
  /** Base URL of the PGSB API (default: https://op1.pgsb.ir). */
  shahkarBaseUrl: string;
  /** The Basic authorization key of the OAuth token endpoint. */
  shahkarBasicKey: string;
  /** OAuth username. */
  shahkarUsername: string;
  /** OAuth password. */
  shahkarPassword: string;
  /** The pid header key of the match service. */
  shahkarPid: string;
  /** The basicAuthorization header key of the match service. */
  shahkarBasicAuthKey: string;
  /** EC public key (PEM) used to JWE-encrypt the national id and mobile. */
  shahkarPublicKeyPem: string;

  // --- مرجوعی کالا -------------------------------------------------------
  /** فعال‌سازی مرجوعی کالا — دکمه «درخواست مرجوعی» در حساب مشتری ظاهر می‌شود. */
  returnEnabled: boolean;
  /** مهلت مرجوعی — روز از تحویل سفارش؛ رشتهٔ عددی ۱ تا ۳۶۵ در AppConfig. */
  returnWindowDays: string;
  /** پرداخت‌کننده پیش‌فرض هزینه ارسال برگشت — 'customer' | 'shop' (قابل
   * تغییر برای هر درخواست هنگام تایید). */
  returnDefaultShipPayer: string;
  /** پیک مخصوص دریافت مرجوعی — گزینهٔ «جمع‌آوری توسط فروشگاه» در تایید مالک. */
  returnCourierEnabled: boolean;

  // --- پشتیبانی آنلاین (ویجت چت فروشگاه) ---------------------------------
  /** خاموشی آن = ویجت برداشته می‌شود و API مشتری/مهمان ۴۰۳ می‌دهد؛ پنل سالم می‌ماند. */
  supportEnabled: boolean;
  /** متن خوش‌آمد ابتدای گفتگو؛ خالی = متن پیش‌فرض. */
  supportWelcome: string;
  /** گوشه صفحه برای دکمه شناور — whitelist در lib/support-widget. */
  supportWidgetPosition: string;
  /** انیمیشن ورود دکمه — whitelist در lib/support-widget. */
  supportWidgetAnimation: string;
  /** ثانیه انتظار قبل از نمایش دکمه؛ رشتهٔ عددی تا ۳ رقم. */
  supportWidgetDelay: string;
  /** حباب خوش‌آمد کنار دکمه — هر نشست یک‌بار. */
  supportWidgetNoticeEnabled: boolean;
  /** ثانیه ماندن حباب؛ ۰ = تا بستن دستی. */
  supportWidgetNoticeSeconds: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  activeGateways: [],
  defaultGateway: '',
  activeSmsPanel: '',
  zarinpalMerchantId: '',
  zarinpalSandbox: false,
  idpayApiKey: '',
  idpaySandbox: false,
  parsianPin: '',
  mellatTerminalId: '',
  mellatUsername: '',
  mellatPassword: '',
  samanTerminalId: '',
  sadadMerchantId: '',
  sadadTerminalId: '',
  sadadTerminalKey: '',
  sepahMerchantId: '',
  sepahTerminalId: '',
  sepahPassword: '',
  sizpayMerchantId: '',
  sizpayTerminalId: '',
  sizpaySecretKey1: '',
  sizpaySecretKey2: '',
  sizpayDigitalSign: '',
  pasargadUsername: '',
  pasargadPassword: '',
  pasargadTerminalCode: '',
  digipayUsername: '',
  digipayPassword: '',
  digipaySandbox: false,
  snapppayClientId: '',
  snapppayClientSecret: '',
  snapppayUsername: '',
  snapppayPassword: '',
  snapppayBaseUrl: '',
  taraApiKey: '',
  taraRequestUrl: '',
  taraVerifyUrl: '',
  vibeApiKey: '',
  vibeInstallments: '3',
  keepaClientId: '',
  keepaClientSecret: '',
  keepaTerminalId: '',
  minipayMerchantId: '',
  fakherNationalCode: '',
  fakherTerminalNumber: '',
  medianaApiKey: '',
  medianaSendingNumber: '',
  smsirApiKey: '',
  smsirLineNumber: '',
  smsirPatternConfig: EMPTY_PANEL_PATTERN_CONFIG,
  melipayamakUsername: '',
  melipayamakPassword: '',
  melipayamakLineNumber: '',
  farazsmsApiKey: '',
  farazsmsLineNumber: '',
  farazPatternConfig: EMPTY_PANEL_PATTERN_CONFIG,
  payamresanUsername: '',
  payamresanPassword: '',
  payamresanLineNumber: '',
  smsFactorEnabled: true,
  smsTemplate: DEFAULT_SMS_TEMPLATE,
  smsUsePattern: false,
  medianaPatternCode: '',
  medianaPatternParams: [],
  smsNoticeEnabled: true,
  smsNoticeTemplate: DEFAULT_SMS_NOTICE_TEMPLATE,
  smsPickupChangeEnabled: true,
  smsPickupChangeTemplate: DEFAULT_SMS_PICKUP_CHANGE_TEMPLATE,
  smsNoticeUsePattern: false,
  medianaNoticePatternCode: '',
  medianaNoticePatternParams: [],
  paymentLinkSmsEnabled: true,
  paymentLinkSmsTemplate: DEFAULT_PAYMENT_LINK_TEMPLATE,
  paymentLinkUsePattern: false,
  medianaPaymentLinkPatternCode: '',
  medianaPaymentLinkPatternParams: [],
  otpSmsEnabled: true,
  otpSmsTemplate: DEFAULT_OTP_TEMPLATE,
  medianaOtpUsePattern: false,
  medianaOtpPatternCode: '',
  medianaOtpPatternParams: [],
  loginPolicy: '',
  shahkarEnabled: false,
  shahkarBaseUrl: 'https://op1.pgsb.ir',
  shahkarBasicKey: '',
  shahkarUsername: '',
  shahkarPassword: '',
  shahkarPid: '',
  shahkarBasicAuthKey: '',
  shahkarPublicKeyPem: '',
  // مرجوعی به‌صورت پیش‌فرض فعال است — تجربهٔ انتظارِ فروشگاه؛ از
  // /settings/returns قابل خاموش‌کردن است (پنجرهٔ روزها هم آن‌جاست).
  returnEnabled: true,
  returnWindowDays: '7',
  returnDefaultShipPayer: 'customer',
  returnCourierEnabled: false,
  supportEnabled: true,
  supportWelcome: '',
  supportWidgetPosition: 'bottom-left',
  supportWidgetAnimation: 'fade',
  supportWidgetDelay: '0',
  supportWidgetNoticeEnabled: true,
  supportWidgetNoticeSeconds: '8',
};

/* ---------------------------------------------------------------------------
 * Field specs — one row per AppSettings field. `secret` fields are stored
 * verbatim; plain strings are trimmed before storage.
 * ------------------------------------------------------------------------ */

type FieldSpec =
  | { kind: 'string'; key: string; label: string; secret?: boolean }
  | { kind: 'boolean'; key: string; label: string }
  | { kind: 'patternParams'; key: string; label: string }
  | { kind: 'panelPattern'; key: string; label: string }
  | { kind: 'stringList'; key: string; label: string };

/** One row per AppSettings field — exported for the admin settings API. */
export const FIELD_SPECS: Record<keyof AppSettings, FieldSpec> = {
  activeGateways: { kind: 'stringList', key: 'active_gateways', label: 'درگاه‌های فعال' },
  defaultGateway: { kind: 'string', key: 'default_gateway', label: 'درگاه پیش‌فرض' },
  activeSmsPanel: { kind: 'string', key: 'active_sms_panel', label: 'پنل پیامکی فعال' },

  zarinpalMerchantId: {
    kind: 'string',
    key: 'zarinpal_merchant_id',
    label: 'کلید فروشندگی زرین‌پال',
  },
  zarinpalSandbox: { kind: 'boolean', key: 'zarinpal_sandbox', label: 'حالت آزمایشی زرین‌پال' },
  idpayApiKey: { kind: 'string', key: 'idpay_api_key', label: 'کلید API آیدی‌پی', secret: true },
  idpaySandbox: { kind: 'boolean', key: 'idpay_sandbox', label: 'حالت آزمایشی آیدی‌پی' },
  parsianPin: { kind: 'string', key: 'parsian_pin', label: 'شناسه پین پارسیان', secret: true },
  mellatTerminalId: { kind: 'string', key: 'mellat_terminal_id', label: 'شناسه پایانه ملت' },
  mellatUsername: { kind: 'string', key: 'mellat_username', label: 'نام کاربری ملت' },
  mellatPassword: { kind: 'string', key: 'mellat_password', label: 'رمز عبور ملت', secret: true },
  samanTerminalId: { kind: 'string', key: 'saman_terminal_id', label: 'شناسه پایانه سامان' },
  sadadMerchantId: { kind: 'string', key: 'sadad_merchant_id', label: 'شناسه پذیرنده سداد' },
  sadadTerminalId: { kind: 'string', key: 'sadad_terminal_id', label: 'شناسه پایانه سداد' },
  sadadTerminalKey: {
    kind: 'string',
    key: 'sadad_terminal_key',
    label: 'کلید ترمینال سداد',
    secret: true,
  },
  sepahMerchantId: { kind: 'string', key: 'sepah_merchant_id', label: 'شناسه پذیرنده سپه' },
  sepahTerminalId: { kind: 'string', key: 'sepah_terminal_id', label: 'شناسه پایانه سپه' },
  sepahPassword: { kind: 'string', key: 'sepah_password', label: 'رمز عبور سپه', secret: true },
  sizpayMerchantId: { kind: 'string', key: 'sizpay_merchant_id', label: 'شناسه پذیرنده سیزپی' },
  sizpayTerminalId: { kind: 'string', key: 'sizpay_terminal_id', label: 'شناسه پایانه سیزپی' },
  sizpaySecretKey1: {
    kind: 'string',
    key: 'sizpay_secret_key1',
    label: 'کلید امنیتی ۱ سیزپی',
    secret: true,
  },
  sizpaySecretKey2: {
    kind: 'string',
    key: 'sizpay_secret_key2',
    label: 'کلید امنیتی ۲ سیزپی',
    secret: true,
  },
  sizpayDigitalSign: {
    kind: 'string',
    key: 'sizpay_digital_sign',
    label: 'امضای دیجیتال سیزپی',
    secret: true,
  },
  pasargadUsername: { kind: 'string', key: 'pasargad_username', label: 'نام کاربری پاسارگاد' },
  pasargadPassword: {
    kind: 'string',
    key: 'pasargad_password',
    label: 'رمز عبور پاسارگاد',
    secret: true,
  },
  pasargadTerminalCode: {
    kind: 'string',
    key: 'pasargad_terminal_code',
    label: 'کد پایانه پاسارگاد',
  },

  digipayUsername: { kind: 'string', key: 'digipay_username', label: 'نام کاربری دیجی‌پی' },
  digipayPassword: {
    kind: 'string',
    key: 'digipay_password',
    label: 'رمز عبور دیجی‌پی',
    secret: true,
  },
  digipaySandbox: { kind: 'boolean', key: 'digipay_sandbox', label: 'حالت آزمایشی دیجی‌پی' },
  snapppayClientId: { kind: 'string', key: 'snapppay_client_id', label: 'Client ID اسنپ‌پی' },
  snapppayClientSecret: {
    kind: 'string',
    key: 'snapppay_client_secret',
    label: 'Client Secret اسنپ‌پی',
    secret: true,
  },
  snapppayUsername: { kind: 'string', key: 'snapppay_username', label: 'نام کاربری اسنپ‌پی' },
  snapppayPassword: {
    kind: 'string',
    key: 'snapppay_password',
    label: 'رمز عبور اسنپ‌پی',
    secret: true,
  },
  snapppayBaseUrl: { kind: 'string', key: 'snapppay_base_url', label: 'آدرس سرویس اسنپ‌پی' },
  taraApiKey: { kind: 'string', key: 'tara_api_key', label: 'کلید API تارا', secret: true },
  taraRequestUrl: { kind: 'string', key: 'tara_request_url', label: 'آدرس درخواست تارا' },
  taraVerifyUrl: { kind: 'string', key: 'tara_verify_url', label: 'آدرس تأیید تارا' },
  vibeApiKey: { kind: 'string', key: 'vibe_api_key', label: 'کلید API وایب', secret: true },
  vibeInstallments: { kind: 'string', key: 'vibe_installments', label: 'تعداد اقساط وایب' },
  keepaClientId: { kind: 'string', key: 'keepa_client_id', label: 'Client ID کیپا' },
  keepaClientSecret: {
    kind: 'string',
    key: 'keepa_client_secret',
    label: 'Client Secret کیپا',
    secret: true,
  },
  keepaTerminalId: { kind: 'string', key: 'keepa_terminal_id', label: 'شناسه پایانه کیپا' },
  minipayMerchantId: {
    kind: 'string',
    key: 'minipay_merchant_id',
    label: 'شناسه پذیرنده مینی‌پی',
    secret: true,
  },
  fakherNationalCode: {
    kind: 'string',
    key: 'fakher_national_code',
    label: 'کد ملی پذیرنده فاخر',
  },
  fakherTerminalNumber: {
    kind: 'string',
    key: 'fakher_terminal_number',
    label: 'شماره پایانه فاخر',
  },

  medianaApiKey: { kind: 'string', key: 'mediana_api_key', label: 'کلید API مدیانا', secret: true },
  medianaSendingNumber: {
    kind: 'string',
    key: 'mediana_sending_number',
    label: 'شماره خط ارسال مدیانا',
  },
  smsirApiKey: { kind: 'string', key: 'smsir_api_key', label: 'کلید API sms.ir', secret: true },
  smsirLineNumber: { kind: 'string', key: 'smsir_line_number', label: 'خط ارسال sms.ir' },
  smsirPatternConfig: {
    kind: 'panelPattern',
    key: 'smsir_pattern_config',
    label: 'الگوهای sms.ir',
  },
  melipayamakUsername: {
    kind: 'string',
    key: 'melipayamak_username',
    label: 'نام کاربری ملی‌پیامک',
  },
  melipayamakPassword: {
    kind: 'string',
    key: 'melipayamak_password',
    label: 'رمز وبسرویس ملی‌پیامک',
    secret: true,
  },
  melipayamakLineNumber: {
    kind: 'string',
    key: 'melipayamak_line_number',
    label: 'خط ارسال ملی‌پیامک',
  },
  farazsmsApiKey: {
    kind: 'string',
    key: 'farazsms_api_key',
    label: 'کلید API فراز اس‌ام‌اس',
    secret: true,
  },
  farazsmsLineNumber: {
    kind: 'string',
    key: 'farazsms_line_number',
    label: 'خط ارسال فراز اس‌ام‌اس',
  },
  farazPatternConfig: {
    kind: 'panelPattern',
    key: 'faraz_pattern_config',
    label: 'الگوهای فراز اس‌ام‌اس',
  },
  payamresanUsername: {
    kind: 'string',
    key: 'payamresan_username',
    label: 'نام کاربری پیام رسان',
  },
  payamresanPassword: {
    kind: 'string',
    key: 'payamresan_password',
    label: 'رمز وبسرویس پیام رسان',
    secret: true,
  },
  payamresanLineNumber: {
    kind: 'string',
    key: 'payamresan_line_number',
    label: 'خط ارسال پیام رسان',
  },

  smsFactorEnabled: {
    kind: 'boolean',
    key: 'sms_factor_enabled',
    label: 'فعال بودن پیامک فاکتور',
  },
  smsTemplate: { kind: 'string', key: 'sms_template', label: 'متن پیامک فاکتور' },
  smsUsePattern: {
    kind: 'boolean',
    key: 'mediana_use_pattern',
    label: 'ارسال فاکتور با الگوی مدیانا',
  },
  medianaPatternCode: {
    kind: 'string',
    key: 'mediana_pattern_code',
    label: 'کد پترنی فاکتور مدیانا',
  },
  medianaPatternParams: {
    kind: 'patternParams',
    key: 'mediana_pattern_params',
    label: 'پارامترهای پترنی فاکتور مدیانا',
  },
  smsNoticeEnabled: {
    kind: 'boolean',
    key: 'sms_notice_enabled',
    label: 'فعال بودن پیامک اطلاع‌رسانی',
  },
  smsNoticeTemplate: { kind: 'string', key: 'sms_notice_template', label: 'متن پیامک اطلاع‌رسانی' },
  smsPickupChangeEnabled: {
    kind: 'boolean',
    key: 'sms_pickup_change_enabled',
    label: 'فعال بودن پیامک تغییر تحویل حضوری',
  },
  smsPickupChangeTemplate: {
    kind: 'string',
    key: 'sms_pickup_change_template',
    label: 'متن پیامک تغییر تحویل حضوری',
  },
  smsNoticeUsePattern: {
    kind: 'boolean',
    key: 'mediana_notice_use_pattern',
    label: 'ارسال اطلاع‌رسانی با الگوی مدیانا',
  },
  medianaNoticePatternCode: {
    kind: 'string',
    key: 'mediana_notice_pattern_code',
    label: 'کد پترنی اطلاع‌رسانی مدیانا',
  },
  medianaNoticePatternParams: {
    kind: 'patternParams',
    key: 'mediana_notice_pattern_params',
    label: 'پارامترهای پترنی اطلاع‌رسانی مدیانا',
  },
  paymentLinkSmsEnabled: {
    kind: 'boolean',
    key: 'payment_link_sms_enabled',
    label: 'فعال بودن پیامک لینک پرداخت',
  },
  paymentLinkSmsTemplate: {
    kind: 'string',
    key: 'payment_link_sms_template',
    label: 'متن پیامک لینک پرداخت',
  },
  paymentLinkUsePattern: {
    kind: 'boolean',
    key: 'payment_link_use_pattern',
    label: 'ارسال لینک پرداخت با الگوی مدیانا',
  },
  medianaPaymentLinkPatternCode: {
    kind: 'string',
    key: 'mediana_payment_link_pattern_code',
    label: 'کد پترنی لینک پرداخت مدیانا',
  },
  medianaPaymentLinkPatternParams: {
    kind: 'patternParams',
    key: 'mediana_payment_link_pattern_params',
    label: 'پارامترهای پترنی لینک پرداخت مدیانا',
  },
  otpSmsEnabled: { kind: 'boolean', key: 'otp_sms_enabled', label: 'فعال بودن پیامک کد ورود' },
  otpSmsTemplate: { kind: 'string', key: 'otp_sms_template', label: 'متن پیامک کد ورود' },
  medianaOtpUsePattern: {
    kind: 'boolean',
    key: 'mediana_otp_use_pattern',
    label: 'ارسال کد ورود با الگوی مدیانا',
  },
  medianaOtpPatternCode: {
    kind: 'string',
    key: 'mediana_otp_pattern_code',
    label: 'کد پترنی کد ورود مدیانا',
  },
  medianaOtpPatternParams: {
    kind: 'patternParams',
    key: 'mediana_otp_pattern_params',
    label: 'پارامترهای پترنی کد ورود مدیانا',
  },

  loginPolicy: { kind: 'string', key: 'login_policy', label: 'سیاست ورود سایت' },

  shahkarEnabled: { kind: 'boolean', key: 'shahkar_enabled', label: 'فعال‌سازی تطبیق شاهکار' },
  shahkarBaseUrl: { kind: 'string', key: 'shahkar_base_url', label: 'آدرس سرویس شاهکار' },
  shahkarBasicKey: {
    kind: 'string',
    key: 'shahkar_basic_key',
    label: 'کلید Basic توکن شاهکار',
    secret: true,
  },
  shahkarUsername: { kind: 'string', key: 'shahkar_username', label: 'نام کاربری شاهکار' },
  shahkarPassword: {
    kind: 'string',
    key: 'shahkar_password',
    label: 'رمز عبور شاهکار',
    secret: true,
  },
  shahkarPid: { kind: 'string', key: 'shahkar_pid', label: 'کلید pid سرویس شاهکار', secret: true },
  shahkarBasicAuthKey: {
    kind: 'string',
    key: 'shahkar_basic_auth_key',
    label: 'کلید basicAuthorization شاهکار',
    secret: true,
  },
  shahkarPublicKeyPem: {
    kind: 'string',
    key: 'shahkar_public_key_pem',
    label: 'کلید عمومی EC شاهکار (PEM)',
  },

  returnEnabled: { kind: 'boolean', key: 'return_enabled', label: 'فعال‌سازی مرجوعی کالا' },
  returnWindowDays: { kind: 'string', key: 'return_window_days', label: 'مهلت مرجوعی (روز)' },
  returnDefaultShipPayer: {
    kind: 'string',
    key: 'return_default_ship_payer',
    label: 'پرداخت‌کننده پیش‌فرض هزینه ارسال برگشت',
  },
  returnCourierEnabled: {
    kind: 'boolean',
    key: 'return_courier_enabled',
    label: 'پیک مخصوص دریافت مرجوعی',
  },

  supportEnabled: { kind: 'boolean', key: 'support_enabled', label: 'فعال بودن پشتیبانی آنلاین' },
  supportWelcome: { kind: 'string', key: 'support_welcome', label: 'متن خوش‌آمد گفتگو' },
  supportWidgetPosition: {
    kind: 'string',
    key: 'support_widget_position',
    label: 'جای آیکون ویجت پشتیبانی',
  },
  supportWidgetAnimation: {
    kind: 'string',
    key: 'support_widget_animation',
    label: 'انیمیشن نمایش ویجت پشتیبانی',
  },
  supportWidgetDelay: {
    kind: 'string',
    key: 'support_widget_delay',
    label: 'تأخیر نمایش آیکون ویجت (ثانیه)',
  },
  supportWidgetNoticeEnabled: {
    kind: 'boolean',
    key: 'support_widget_notice_enabled',
    label: 'نمایش پیام خوش‌آمد ویجت',
  },
  supportWidgetNoticeSeconds: {
    kind: 'string',
    key: 'support_widget_notice_seconds',
    label: 'مدت نمایش پیام خوش‌آمد ویجت (ثانیه)',
  },
};

/* ---------------------------------------------------------------------------
 * JSON column parsers (SQLite has no Json type).
 * ------------------------------------------------------------------------ */

/** Pattern parameters are stored as a JSON string (SQLite has no Json column). */
function parsePatternParams(json: string | undefined): SmsPatternParam[] {
  if (!json) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is SmsPatternParam =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as SmsPatternParam).key === 'string' &&
        typeof (item as SmsPatternParam).value === 'string'
    );
  } catch {
    return [];
  }
}

function parsePatternKind(value: unknown): PanelPatternKindConfig {
  if (typeof value !== 'object' || value === null) {
    return EMPTY_PATTERN_KIND;
  }
  const record = value as Record<string, unknown>;
  return {
    enabled: record.enabled === true,
    code: typeof record.code === 'string' ? record.code : '',
    params: parsePatternParams(JSON.stringify(Array.isArray(record.params) ? record.params : [])),
  };
}

function parsePanelPatternConfig(json: string | undefined): PanelPatternConfig {
  if (!json) {
    return EMPTY_PANEL_PATTERN_CONFIG;
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) {
      return EMPTY_PANEL_PATTERN_CONFIG;
    }
    const record = parsed as Record<string, unknown>;
    return {
      factor: parsePatternKind(record.factor),
      notice: parsePatternKind(record.notice),
      otp: parsePatternKind(record.otp),
      payment_link: parsePatternKind(record.payment_link),
      // JSONهای ذخیره‌شده پیش از این فیچر کلید pickup_change ندارند → EMPTY.
      pickup_change: parsePatternKind(record.pickup_change),
    };
  } catch {
    return EMPTY_PANEL_PATTERN_CONFIG;
  }
}

function parseStringList(json: string | undefined): string[] {
  if (!json) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function readBoolean(value: string | undefined): boolean {
  return value === 'true';
}

/* ---------------------------------------------------------------------------
 * Read / write.
 * ------------------------------------------------------------------------ */

/** All panel settings, falling back to defaults for missing keys. */
export async function getAppSettings(): Promise<AppSettings> {
  const rows = await prisma.appConfig.findMany({
    where: { key: { in: Object.values(FIELD_SPECS).map((spec) => spec.key) } },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));

  const settings = {} as AppSettings;
  for (const [field, spec] of Object.entries(FIELD_SPECS) as [keyof AppSettings, FieldSpec][]) {
    const stored = values.get(spec.key);
    switch (spec.kind) {
      case 'string':
        settings[field] = (spec.secret ? (stored ?? '') : (stored?.trim() ?? '')) as never;
        break;
      case 'boolean':
        // ردیف غایب یعنی «هرگز دست‌خورده» → پیش‌فرض خود کلید؛ نه عمداً خاموش
        // (مهم برای سوییچ‌هایی که پیش‌فرضشان روشن است مثل supportEnabled).
        settings[field] = (
          stored === undefined ? DEFAULT_SETTINGS[field] : readBoolean(stored)
        ) as never;
        break;
      case 'patternParams':
        settings[field] = parsePatternParams(stored) as never;
        break;
      case 'panelPattern':
        settings[field] = parsePanelPatternConfig(stored) as never;
        break;
      case 'stringList':
        settings[field] = parseStringList(stored) as never;
        break;
    }
  }

  // Defaults that must survive even when the stored row is empty.
  settings.smsTemplate = values.get(FIELD_SPECS.smsTemplate.key)?.trim() || DEFAULT_SMS_TEMPLATE;
  settings.smsNoticeTemplate =
    values.get(FIELD_SPECS.smsNoticeTemplate.key)?.trim() || DEFAULT_SMS_NOTICE_TEMPLATE;
  settings.smsPickupChangeTemplate =
    values.get(FIELD_SPECS.smsPickupChangeTemplate.key)?.trim() ||
    DEFAULT_SMS_PICKUP_CHANGE_TEMPLATE;
  settings.paymentLinkSmsTemplate =
    values.get(FIELD_SPECS.paymentLinkSmsTemplate.key)?.trim() || DEFAULT_PAYMENT_LINK_TEMPLATE;
  settings.otpSmsTemplate =
    values.get(FIELD_SPECS.otpSmsTemplate.key)?.trim() || DEFAULT_OTP_TEMPLATE;
  // An empty base URL row means «use the provider default».
  settings.shahkarBaseUrl =
    values.get(FIELD_SPECS.shahkarBaseUrl.key)?.trim() || DEFAULT_SETTINGS.shahkarBaseUrl;

  // مرجوعی: ردیف خالی/غایب یعنی تنظیم دست نخورده — مقادیر پیش‌فرض معقول.
  settings.returnWindowDays =
    values.get(FIELD_SPECS.returnWindowDays.key)?.trim() || DEFAULT_SETTINGS.returnWindowDays;
  settings.returnDefaultShipPayer =
    values.get(FIELD_SPECS.returnDefaultShipPayer.key)?.trim() ||
    DEFAULT_SETTINGS.returnDefaultShipPayer;

  return settings;
}

/** Persists the provided keys; missing/empty values clear the stored entry. */
export async function saveAppSettings(input: Partial<AppSettings>): Promise<AppSettings> {
  const entries: [string, string][] = [];

  for (const [field, spec] of Object.entries(FIELD_SPECS) as [keyof AppSettings, FieldSpec][]) {
    const value = input[field];
    if (value === undefined) {
      continue;
    }
    switch (spec.kind) {
      case 'string':
        entries.push([spec.key, spec.secret ? String(value) : String(value).trim()]);
        break;
      case 'boolean':
        entries.push([spec.key, String(value)]);
        break;
      case 'patternParams': {
        const clean = (value as SmsPatternParam[]).filter((param) => param.key.trim() !== '');
        entries.push([spec.key, JSON.stringify(clean)]);
        break;
      }
      case 'panelPattern':
        entries.push([spec.key, JSON.stringify(value)]);
        break;
      case 'stringList':
        entries.push([spec.key, JSON.stringify(value)]);
        break;
    }
  }

  for (const [key, value] of entries) {
    if (value === '' || value === '[]' || value === '{}') {
      await prisma.appConfig.deleteMany({ where: { key } });
    } else {
      await prisma.appConfig.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
  }

  return getAppSettings();
}
