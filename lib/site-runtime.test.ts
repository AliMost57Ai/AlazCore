/**
 * تست ماتریس resolve دامنه (lib/site-runtime.ts) — تسک site-tenant-resolution.
 * قرارداد: توسعه با SHOP_DOMAIN به آدرس بی‌توجه است؛ production فقط از Host
 * می‌خواند (SHOP_DOMAIN تنها برای درخواست localhost/سرور تست)؛ localhost بدون
 * SHOP_DOMAIN → null.
 */

import { resolveSiteDomain } from './site-runtime';

const realEnv = { ...process.env };

function withEnv(env: Record<string, string | undefined>, fn: () => void): void {
  const previousNodeEnv = process.env.NODE_ENV;
  const writable = process.env as Record<string, string | undefined>;
  try {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        writable[key] = value;
      }
    }
    fn();
  } finally {
    writable.NODE_ENV = previousNodeEnv;
    if (realEnv.SHOP_DOMAIN === undefined) {
      delete process.env.SHOP_DOMAIN;
    } else {
      process.env.SHOP_DOMAIN = realEnv.SHOP_DOMAIN;
    }
  }
}

describe('resolveSiteDomain — توسعه (NODE_ENV=test)', () => {
  it('SHOP_DOMAIN ست → همان دامنه، بی‌توجه به Host درخواست', () => {
    withEnv({ SHOP_DOMAIN: 'shop2.ir' }, () => {
      expect(resolveSiteDomain({ host: 'localhost:3000' })).toBe('shop2.ir');
      expect(resolveSiteDomain({ host: '192.168.1.10' })).toBe('shop2.ir');
      expect(resolveSiteDomain({ forwardedHost: 'other.ir', host: 'other.ir' })).toBe('shop2.ir');
    });
  });

  it('بدون SHOP_DOMAIN → دامنه‌ی واقعی Host (تست با hosts-file)', () => {
    withEnv({ SHOP_DOMAIN: undefined }, () => {
      expect(resolveSiteDomain({ host: 'shop2.ir' })).toBe('shop2.ir');
      expect(resolveSiteDomain({ host: 'SHOP2.IR:3000' })).toBe('shop2.ir');
      expect(resolveSiteDomain({ host: 'www.shop2.ir' })).toBe('shop2.ir');
    });
  });

  it('localhost/بدون هدر → null (دیتابیس اصلی dev)', () => {
    withEnv({ SHOP_DOMAIN: undefined }, () => {
      expect(resolveSiteDomain({ host: 'localhost:3000' })).toBeNull();
      expect(resolveSiteDomain({ host: '127.0.0.1:3005' })).toBeNull();
      expect(resolveSiteDomain({ host: null })).toBeNull();
    });
  });

  it('نرمال‌سازی: پروتکل/پورت/www حذف و lowercase می‌شود', () => {
    withEnv({ SHOP_DOMAIN: 'https://WWW.Shop2.ir:443/path' }, () => {
      expect(resolveSiteDomain({ host: 'localhost' })).toBe('shop2.ir');
    });
  });

  it('SHOP_DOMAIN=localhost به‌عنوان override معتبر نیست', () => {
    withEnv({ SHOP_DOMAIN: 'localhost' }, () => {
      expect(resolveSiteDomain({ host: 'localhost:3000' })).toBeNull();
    });
  });
});

describe('resolveSiteDomain — production (NODE_ENV=production)', () => {
  const prod = { NODE_ENV: 'production' as string | undefined };

  it('دامنه‌ی واقعی → فقط Host؛ SHOP_DOMAIN نادیده و هشدار', () => {
    withEnv({ ...prod, SHOP_DOMAIN: 'shop2.ir' }, () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        expect(resolveSiteDomain({ host: 'joghd.ir' })).toBe('joghd.ir');
        expect(warn).toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });
  });

  it('درخواست localhost با SHOP_DOMAIN → override (سرور تست next start)', () => {
    withEnv({ ...prod, SHOP_DOMAIN: 'shop2.ir' }, () => {
      expect(resolveSiteDomain({ host: 'localhost:3005' })).toBe('shop2.ir');
      expect(resolveSiteDomain({ host: '127.0.0.1' })).toBe('shop2.ir');
    });
  });

  it('درخواست localhost بدون SHOP_DOMAIN → null (fail-closed سمت caller)', () => {
    withEnv({ ...prod, SHOP_DOMAIN: undefined }, () => {
      expect(resolveSiteDomain({ host: 'localhost:3000' })).toBeNull();
      // IP هم مثل یک «دامنه» resolve می‌شود — fail-closed آن در گیتِ نبودِ
      // فایل دیتابیس پراکسی اتفاق می‌افتد (no site DB for the IP).
      expect(resolveSiteDomain({ host: '192.168.1.10' })).toBe('192.168.1.10');
    });
  });

  it('production بدون SHOP_DOMAIN → دامنه‌ی Host', () => {
    withEnv({ ...prod, SHOP_DOMAIN: undefined }, () => {
      expect(resolveSiteDomain({ host: 'joghd.ir' })).toBe('joghd.ir');
    });
  });
});
