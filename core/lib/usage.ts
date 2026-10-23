/**
 * تشخیص «در حال استفاده بودن» یک درگاه/پنل پیامکی برای یک دامین — مبنای
 * قاعده‌ی کاربر: کارشناس Core نمی‌تواند تخصیصِ موردِ در حال استفاده را حذف
 * کند؛ بقیه مطابق تنظیمات Core تغییر می‌کنند.
 *
 * «استفاده شده» یعنی یکی از این دو (در دیتابیس خود سایت):
 *  ۱. مالک برای آن درگاه/پنل تنظیمات وارد کرده — ردیف AppConfig با پیشوند
 *     شناسه و مقدار غیرخالی؛
 *  ۲. تراکنش واقعی از مسیر آن درگاه ثبت شده (OnlinePaymentTransaction).
 *
 * خواندن با API خود فروشگاه (POST /api/core/integration-usage با کلید
 * x-core-key و هدر x-site-domain) — دسترسی مستقیم به دیتابیس سایت ممنوع.
 */

import { shopApi } from './shop-api';

interface UsageResponse {
  gateways: Record<string, boolean>;
  sms: Record<string, boolean>;
}

/**
 * پیام مشترک هر دو تابع: null یعنی «نمی‌دانیم» (فروشگاه در دسترس نبود یا
 * کلید رد شد) — caller تصمیم می‌گیرد؛ پیش‌فرض امن = حذف نکن.
 */
async function usageFor(
  domain: string,
  group: 'gateways' | 'sms',
  id: string
): Promise<boolean | null> {
  if (!domain) {
    return null;
  }
  const data = await shopApi<UsageResponse>('/api/core/integration-usage', {
    domain,
    body: { [group]: [id] },
  });
  if (!data) {
    return null;
  }
  const map = data[group];
  return typeof map?.[id] === 'boolean' ? map[id] : null;
}

/**
 * آیا این درگاه برای دامین «در حال استفاده» است؟
 * true/false — و null یعنی پاسخ فروشگاه در دسترس نبود (fail-safe حذف نکن).
 */
export async function isGatewayInUse(domain: string, gatewayId: string): Promise<boolean | null> {
  return usageFor(domain, 'gateways', gatewayId);
}

/** آیا این پنل پیامکی برای دامین «در حال استفاده» است؟ (تنظیمات واردشده) */
export async function isSmsPanelInUse(domain: string, providerId: string): Promise<boolean | null> {
  return usageFor(domain, 'sms', providerId);
}
