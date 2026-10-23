/**
 * کلاینت API فروشگاه از سمت پنل Core — قاعده تبادل دیتا: هیچ خواندن
 * مستقیمی از دیتابیس سایت‌ها مجاز نیست؛ همه‌چیز از راه HTTP با کلید
 * x-core-key (همان اعتماد دوطرفه /api/validate) و هدر x-site-domain برای
 * انتخاب دیتابیس سایت مقصد.
 *
 * SHOP_API_URL پایه فروشگاه است (dev: http://127.0.0.1:3000)؛ کلید از
 * CoreSetting/ENV — همان resolveApiKey اعتبارسنجی لایسنس.
 */

import { resolveApiKey } from './licensing';

export function shopApiBase(): string {
  return (process.env.SHOP_API_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
}

export interface ShopApiCall {
  domain?: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
}

/**
 * یک فراخوانی به فروشگاه؛ هر شکست (اتصال، 401/403/500، timeout) → null تا
 * caller با fail-safe تصمیم بگیرد (مثل «حذف نکن» در قاعده در-حال-استفاده).
 */
export async function shopApi<T>(path: string, opts: ShopApiCall = {}): Promise<T | null> {
  const key = await resolveApiKey();
  if (!key) {
    return null;
  }

  const url = new URL(`${shopApiBase()}${path}`);
  for (const [name, value] of Object.entries(opts.query ?? {})) {
    if (value) {
      url.searchParams.set(name, value);
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, {
      method: opts.body !== undefined ? 'POST' : 'GET',
      headers: {
        'x-core-key': key,
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.domain ? { 'x-site-domain': opts.domain } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
