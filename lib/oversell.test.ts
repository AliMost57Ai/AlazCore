/**
 * تست قابلیت‌های مجوز (capability) و گیت خالی‌فروشی محصول — تسک
 * «خالی‌فروشی/موجودی هوشمند: زنجیره مجوز».
 */

import { hasCapability } from './nav-permissions';

describe('hasCapability', () => {
  it('قابلیت ثبت‌شده را می‌پذیرد', () => {
    expect(hasCapability(['cap:product-oversell'], 'cap:product-oversell')).toBe(true);
  });

  it('ادمین با "*" همه قابلیت‌ها را دارد', () => {
    expect(hasCapability(['*'], 'cap:product-oversell')).toBe(true);
  });

  it('فهرست خالی یا نامعتبر قابلیت ندارد', () => {
    expect(hasCapability([], 'cap:product-oversell')).toBe(false);
    expect(hasCapability(undefined, 'cap:product-oversell')).toBe(false);
  });

  it('قابلیت‌های دیگر کافی نیستند', () => {
    expect(hasCapability(['/products:edit', '/orders'], 'cap:product-oversell')).toBe(false);
  });
});

describe('ASSIGNABLE_PERMISSIONS', () => {
  it('قابلیت خالی‌فروشی در مجموعه مجاز نقش‌ها هست', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ASSIGNABLE_PERMISSIONS } = require('./nav-permissions') as {
      ASSIGNABLE_PERMISSIONS: string[];
    };
    expect(ASSIGNABLE_PERMISSIONS).toContain('cap:product-oversell');
  });
});

describe('resolveOversellFields', () => {
  const license = {
    ok: true,
    domain: 'shop.test',
    status: 'active' as const,
    oversell: { allowed: true, max: 10 },
  };

  beforeEach(() => {
    jest.resetModules();
     
    jest.doMock('./core-license', () => ({
      getLicense: jest.fn(async () => license),
      currentDomain: jest.fn(async () => 'shop.test'),
    }));
  });

  function makeSession(perms: string[], role: 'admin' | 'member' = 'member') {
    return {
      sub: 'u1',
      name: 'کاربر',
      email: null,
      phone: null,
      role,
      perms,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  async function call(
    body: Record<string, unknown>,
    perms: string[],
    role: 'admin' | 'member' = 'member'
  ) {
     
    const mod = await import('./oversell');
    return mod.resolveOversellFields(
      body,
      makeSession(perms, role) as Parameters<typeof mod.resolveOversellFields>[1]
    );
  }

  it('بدون فیلدهای خالی‌فروشی = بدون تغییر (fields null)', async () => {
    await expect(call({}, ['cap:product-oversell'])).resolves.toEqual({ ok: true, fields: null });
  });

  it('با مجوز نقش، سقف کالا به حد لایسنس clamp می‌شود', async () => {
    const result = await call({ oversellAllowed: true, oversellMax: 25 }, ['cap:product-oversell']);
    expect(result).toEqual({ ok: true, fields: { oversellAllowed: true, oversellMax: 10 } });
  });

  it('ادمین بدون قابلیت نقش هم مجاز است', async () => {
    const result = await call({ oversellAllowed: true, oversellMax: 3 }, [], 'admin');
    expect(result).toEqual({ ok: true, fields: { oversellAllowed: true, oversellMax: 3 } });
  });

  it('بدون قابلیت نقش → 403', async () => {
    const result = await call({ oversellAllowed: true, oversellMax: 3 }, ['/products:edit']);
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it('سقف صفر یا نامعتبر → 400', async () => {
    const result = await call({ oversellAllowed: true, oversellMax: 0 }, ['cap:product-oversell']);
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it('خالی‌فروشی غیرفعال از سوی Core → 403 حتی با مجوز نقش', async () => {
    jest.resetModules();
     
    jest.doMock('./core-license', () => ({
      getLicense: jest.fn(async () => ({ ...license, oversell: { allowed: false, max: 0 } })),
      currentDomain: jest.fn(async () => 'shop.test'),
    }));
    const result = await call({ oversellAllowed: true, oversellMax: 3 }, ['cap:product-oversell']);
    expect(result).toMatchObject({ ok: false, status: 403 });
  });
});
