/**
 * The payment-gateway registry: one descriptor per gateway (online IPG +
 * BNPL) that the settings pages, the checkout route and the payment callback
 * all consume — the single source of truth that replaced the hardcoded
 * per-gateway switches.
 *
 * `start` opens a payment request, `verify` settles it from the callback
 * fields. `isReady` says whether the admin has entered the credentials, and
 * the active/default selection (تنظیمات → درگاه پرداخت) picks which of the
 * ready gateways the customer actually sees at checkout.
 */

import { digipayRequest, digipayVerify } from '../digipay';
import type { AppSettings } from '../settings';
import { snapppayRequest, snapppayVerify } from '../snapppay';
import { taraRequest, taraVerify } from '../tara';
import { zarinpalRequest, zarinpalVerify } from '../zarinpal';
import { fakherStart, fakherVerify } from './fakher';
import { idpayStart, idpayVerify } from './idpay';
import { keepaStart, keepaVerify } from './keepa';
import { mellatStart, mellatVerify } from './mellat';
import { minipayStart, minipayVerify } from './minipay';
import { parsianStart, parsianVerify } from './parsian';
import { pasargadStart, pasargadVerify } from './pasargad';
import { sadadStart, sadadVerify } from './sadad';
import { samanStart, samanVerify } from './saman';
import { sepahStart, sepahVerify } from './sepah';
import { sizpayStart, sizpayVerify } from './sizpay';
import type {
  GatewayStartContext,
  GatewayStartResult,
  GatewayVerifyContext,
  GatewayVerifyResult,
} from './types';
import { vibeStart, vibeVerify } from './vibe';

export type GatewayKind = 'ipg' | 'bnpl';

export interface GatewayDescriptor {
  /** Stable id, stored on transactions and in the settings selection. */
  id: string;
  /** Persian label shown everywhere (admin forms, wallet ledger reasons). */
  label: string;
  kind: GatewayKind;
  /** Whether the admin has entered the credentials this gateway needs. */
  isReady: (settings: AppSettings) => boolean;
  start: (ctx: GatewayStartContext) => Promise<GatewayStartResult>;
  verify: (ctx: GatewayVerifyContext) => Promise<GatewayVerifyResult>;
}

const allSet = (...values: (string | undefined)[]): boolean =>
  values.every((value) => typeof value === 'string' && value.trim() !== '');

export const GATEWAYS: GatewayDescriptor[] = [
  {
    id: 'zarinpal',
    label: 'زرین‌پال',
    kind: 'ipg',
    isReady: (s) => allSet(s.zarinpalMerchantId),
    async start(ctx) {
      const result = await zarinpalRequest({
        merchantId: ctx.settings.zarinpalMerchantId,
        sandbox: ctx.settings.zarinpalSandbox,
        amountToman: ctx.amountToman,
        callbackUrl: ctx.callbackUrl,
        description: ctx.description ?? 'شارژ کیف پول',
        mobile: ctx.mobile,
      });
      return result.ok
        ? {
            ok: true,
            redirectUrl: result.startPayUrl,
            token: result.authority,
            providerId: ctx.providerId,
          }
        : result;
    },
    async verify(ctx) {
      // ZarinPal verifies by authority (the stored token).
      const result = await zarinpalVerify({
        merchantId: ctx.settings.zarinpalMerchantId,
        sandbox: ctx.settings.zarinpalSandbox,
        amountToman: ctx.amountToman,
        authority: ctx.token ?? ctx.params.authority ?? '',
      });
      return result.ok ? { ok: true, refId: result.refId } : result;
    },
  },
  {
    id: 'idpay',
    label: 'آیدی‌پی',
    kind: 'ipg',
    isReady: (s) => allSet(s.idpayApiKey),
    start: idpayStart,
    verify: idpayVerify,
  },
  {
    id: 'parsian',
    label: 'پارسیان',
    kind: 'ipg',
    isReady: (s) => allSet(s.parsianPin),
    start: parsianStart,
    verify: parsianVerify,
  },
  {
    id: 'mellat',
    label: 'ملت',
    kind: 'ipg',
    isReady: (s) => allSet(s.mellatTerminalId, s.mellatUsername, s.mellatPassword),
    start: mellatStart,
    verify: mellatVerify,
  },
  {
    id: 'saman',
    label: 'سامان',
    kind: 'ipg',
    isReady: (s) => allSet(s.samanTerminalId),
    start: samanStart,
    verify: samanVerify,
  },
  {
    id: 'sadad',
    label: 'سداد',
    kind: 'ipg',
    isReady: (s) => allSet(s.sadadMerchantId, s.sadadTerminalId, s.sadadTerminalKey),
    start: sadadStart,
    verify: sadadVerify,
  },
  {
    id: 'sepah',
    label: 'سپه (امیدپی)',
    kind: 'ipg',
    isReady: (s) => allSet(s.sepahMerchantId, s.sepahTerminalId, s.sepahPassword),
    start: sepahStart,
    verify: sepahVerify,
  },
  {
    id: 'sizpay',
    label: 'سیزپی',
    kind: 'ipg',
    isReady: (s) =>
      allSet(
        s.sizpayMerchantId,
        s.sizpayTerminalId,
        s.sizpaySecretKey1,
        s.sizpaySecretKey2,
        s.sizpayDigitalSign
      ),
    start: sizpayStart,
    verify: sizpayVerify,
  },
  {
    id: 'pasargad',
    label: 'پاسارگاد',
    kind: 'ipg',
    isReady: (s) => allSet(s.pasargadUsername, s.pasargadPassword, s.pasargadTerminalCode),
    start: pasargadStart,
    verify: pasargadVerify,
  },
  {
    id: 'digipay',
    label: 'دیجی‌پی',
    kind: 'bnpl',
    isReady: (s) => allSet(s.digipayUsername, s.digipayPassword),
    async start(ctx) {
      const result = await digipayRequest({
        username: ctx.settings.digipayUsername,
        password: ctx.settings.digipayPassword,
        sandbox: ctx.settings.digipaySandbox,
        amountToman: ctx.amountToman,
        providerId: ctx.providerId,
        callbackUrl: ctx.callbackUrl,
        mobile: ctx.mobile ?? '',
      });
      return result.ok
        ? {
            ok: true,
            redirectUrl: result.redirectUrl,
            token: result.trackingCode,
            providerId: result.providerId,
          }
        : result;
    },
    async verify(ctx) {
      const trackingCode = ctx.params.trackingcode ?? '';
      if (!trackingCode) {
        return { ok: false, error: 'کد رهگیری دیجی‌پی در پاسخ درگاه نبود.' };
      }
      const result = await digipayVerify({
        username: ctx.settings.digipayUsername,
        password: ctx.settings.digipayPassword,
        sandbox: ctx.settings.digipaySandbox,
        trackingCode,
        providerId: ctx.providerId,
      });
      return result.ok ? { ok: true, refId: trackingCode, amountRial: result.amountRial } : result;
    },
  },
  {
    id: 'snapppay',
    label: 'اسنپ‌پی',
    kind: 'bnpl',
    isReady: (s) =>
      allSet(s.snapppayClientId, s.snapppayClientSecret, s.snapppayUsername, s.snapppayPassword),
    async start(ctx) {
      const result = await snapppayRequest({
        clientId: ctx.settings.snapppayClientId,
        clientSecret: ctx.settings.snapppayClientSecret,
        username: ctx.settings.snapppayUsername,
        password: ctx.settings.snapppayPassword,
        baseUrl: ctx.settings.snapppayBaseUrl,
        amountToman: ctx.amountToman,
        providerId: ctx.providerId,
        callbackUrl: ctx.callbackUrl,
        mobile: ctx.mobile ?? '',
      });
      return result.ok
        ? {
            ok: true,
            redirectUrl: result.redirectUrl,
            token: result.trackingCode,
            providerId: result.providerId,
          }
        : result;
    },
    async verify(ctx) {
      const trackingCode = ctx.params.trackingcode ?? '';
      if (!trackingCode) {
        return { ok: false, error: 'کد رهگیری اسنپ‌پی در پاسخ درگاه نبود.' };
      }
      const result = await snapppayVerify({
        clientId: ctx.settings.snapppayClientId,
        clientSecret: ctx.settings.snapppayClientSecret,
        username: ctx.settings.snapppayUsername,
        password: ctx.settings.snapppayPassword,
        baseUrl: ctx.settings.snapppayBaseUrl,
        trackingCode,
        providerId: ctx.providerId,
      });
      return result.ok ? { ok: true, refId: trackingCode } : result;
    },
  },
  {
    id: 'tara',
    label: 'تارا',
    kind: 'bnpl',
    isReady: (s) => allSet(s.taraApiKey, s.taraRequestUrl, s.taraVerifyUrl),
    async start(ctx) {
      const result = await taraRequest({
        apiKey: ctx.settings.taraApiKey,
        requestUrl: ctx.settings.taraRequestUrl,
        verifyUrl: ctx.settings.taraVerifyUrl,
        amountToman: ctx.amountToman,
        providerId: ctx.providerId,
        callbackUrl: ctx.callbackUrl,
        mobile: ctx.mobile ?? '',
      });
      return result.ok
        ? {
            ok: true,
            redirectUrl: result.redirectUrl,
            token: result.trackingCode,
            providerId: result.providerId,
          }
        : result;
    },
    async verify(ctx) {
      const trackingCode = ctx.params.trackingcode ?? '';
      if (!trackingCode) {
        return { ok: false, error: 'کد رهگیری تارا در پاسخ درگاه نبود.' };
      }
      const result = await taraVerify({
        apiKey: ctx.settings.taraApiKey,
        requestUrl: ctx.settings.taraRequestUrl,
        verifyUrl: ctx.settings.taraVerifyUrl,
        trackingCode,
        providerId: ctx.providerId,
      });
      return result.ok ? { ok: true, refId: trackingCode } : result;
    },
  },
  {
    id: 'vibe',
    label: 'وایب',
    kind: 'bnpl',
    isReady: (s) => allSet(s.vibeApiKey),
    start: vibeStart,
    verify: vibeVerify,
  },
  {
    id: 'keepa',
    label: 'کیپا',
    kind: 'bnpl',
    isReady: (s) => allSet(s.keepaClientId, s.keepaClientSecret, s.keepaTerminalId),
    start: keepaStart,
    verify: keepaVerify,
  },
  {
    id: 'minipay',
    label: 'مینی‌پی',
    kind: 'bnpl',
    isReady: (s) => allSet(s.minipayMerchantId),
    start: minipayStart,
    verify: minipayVerify,
  },
  {
    id: 'fakher',
    label: 'فاخر',
    kind: 'bnpl',
    isReady: (s) => allSet(s.fakherNationalCode, s.fakherTerminalNumber),
    start: fakherStart,
    verify: fakherVerify,
  },
];

export const GATEWAY_IDS = GATEWAYS.map((gateway) => gateway.id);

export function getGateway(id: string): GatewayDescriptor | null {
  return GATEWAYS.find((gateway) => gateway.id === id) ?? null;
}

export function gatewayLabel(id: string): string {
  return getGateway(id)?.label ?? id;
}

/**
 * The gateways the customer can pick at checkout: the admin's active list
 * (an empty list means "every configured gateway") intersected with the
 * gateways whose credentials are actually entered.
 */
export function activeGatewaysFor(settings: AppSettings): GatewayDescriptor[] {
  const active = settings.activeGateways.filter((id) => GATEWAY_IDS.includes(id));
  const pool =
    active.length > 0 ? GATEWAYS.filter((gateway) => active.includes(gateway.id)) : GATEWAYS;
  return pool.filter((gateway) => gateway.isReady(settings));
}

/** The preselected gateway: the admin's default when active, else the first.
 * A BNPL gateway can never be the default — installment is always a deliberate
 * customer choice, so legacy stored BNPL defaults fall through to the first. */
export function defaultGatewayFor(settings: AppSettings): GatewayDescriptor | null {
  const active = activeGatewaysFor(settings);
  const preferred = active.find(
    (gateway) => gateway.id === settings.defaultGateway && gateway.kind === 'ipg'
  );
  return preferred ?? active[0] ?? null;
}
