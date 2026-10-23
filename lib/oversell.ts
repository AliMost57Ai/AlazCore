/**
 * گیت خالی‌فروشی محصول — زنجیره مجوز دو لایه (تسک «خالی‌فروشی/موجودی
 * هوشمند»): پنل Core برای این دامنه خالی‌فروشی را مجاز کرده باشد (لایسنس)
 * و کاربر ادمین باشد یا نقشش قابلیت 'cap:product-oversell' را داشته باشد.
 * مستقل از prisma تا در تست و API سبک مصرف شود.
 */

import { currentDomain, getLicense } from './core-license';
import { hasCapability } from './nav-permissions';
import { effectivePermissions, type SessionPayload } from './session';

export type OversellResolution =
  | { ok: true; fields: { oversellAllowed: boolean; oversellMax: number | null } | null }
  | { ok: false; status: number; error: string };

/**
 * استخراج و گیت فیلدهای خالی‌فروشی از payload محصول؛ سقف کالا به بازه
 * ۱..حد دامنه clamp می‌شود. اگر هیچ فیلدی نفرستاده شود خروجی fields=null
 * است — یعنی «دست نزن» (ویرایش بدون مجوز، تنظیم موجود را حفظ می‌کند).
 */
export async function resolveOversellFields(
  body: Record<string, unknown>,
  session: SessionPayload
): Promise<OversellResolution> {
  const touches = body.oversellAllowed !== undefined || body.oversellMax !== undefined;
  if (!touches) {
    return { ok: true, fields: null };
  }

  const license = await getLicense(await currentDomain());
  const cap = license?.oversell?.allowed === true ? license.oversell.max : null;
  if (cap === null || cap < 1) {
    return {
      ok: false,
      status: 403,
      error: 'خالی‌فروشی برای فروشگاه شما توسط آلازکور فعال نشده است.',
    };
  }
  if (!hasCapability(effectivePermissions(session), 'cap:product-oversell')) {
    return {
      ok: false,
      status: 403,
      error:
        'برای تنظیم خالی‌فروشی کالا دسترسی ندارید — این مجوز باید از سوی مدیر فروشگاه به نقش شما واگذار شود.',
    };
  }

  if (body.oversellAllowed !== true) {
    return { ok: true, fields: { oversellAllowed: false, oversellMax: null } };
  }

  const raw = body.oversellMax;
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
    return {
      ok: false,
      status: 400,
      error: `تعداد خالی‌فروشی باید عددی بین ۱ و ${cap.toLocaleString('fa-IR')} باشد.`,
    };
  }
  return {
    ok: true,
    fields: { oversellAllowed: true, oversellMax: Math.min(raw, cap) },
  };
}
