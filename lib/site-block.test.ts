/**
 * تست نگاشت «دلیل مسدودسازی → پیام صفحه تعلیق» (lib/site-block.ts).
 *
 * رگرسیونی که این تست قفل می‌کند: قبلاً صفحه‌ی /site-inactive برای دامنه‌ی
 * ثبت‌شده و معتبر هم پیام «این دامنه در سامانه ثبت نشده است» را نشان می‌داد
 * (لایسنس null یا status=active به کلید unknown می‌افتاد). حالا فقط دلیل
 * واقعی license:unknown این پیام را دارد.
 *
 * این ماژول خالص است؛ هر ورودی مربوط به همان درخواست است، پس تست‌ها هم
 * مستقل از دامنه/سایت دیگرند.
 */

import type { CoreLicense } from './core-license';
import {
  blockCode,
  blockCopy,
  blockForLicense,
  blockFromQuery,
  blockSearchParams,
  DB_PENDING_COPY,
  DIRECT_COPY,
  type SiteBlock,
} from './site-block';

function license(overrides: Partial<CoreLicense>): CoreLicense {
  return { ok: true, domain: 'shop140.ir', status: 'active', ...overrides };
}

const NOT_REGISTERED = 'ثبت نشده';

describe('blockForLicense', () => {
  it('لایسنس معتبر بلاک نمی‌سازد', () => {
    expect(blockForLicense(license({}))).toBeNull();
  });

  it('لایسنس null یعنی «نشد بررسی کرد»، نه بلاک', () => {
    expect(blockForLicense(null)).toBeNull();
  });

  it('چهار وضعیت منفی Core همان وضعیت را نگه می‌دارند', () => {
    const statuses = ['unknown', 'inactive', 'suspended', 'expired'] as const;
    for (const status of statuses) {
      const block = blockForLicense(license({ ok: false, status }));
      expect(block).toEqual({ kind: 'license', status });
    }
  });

  it('قطع سرویس با پرچم serviceDown مشخص می‌شود', () => {
    const down = license({ ok: false, status: 'unknown', serviceDown: true });
    expect(blockForLicense(down)).toEqual({ kind: 'license', serviceDown: true });
  });

  it('پاسخ نامتعارف Core «قابل تأیید نیست» است', () => {
    const weird = { ...license({ ok: false }), status: 'weird' } as unknown as CoreLicense;
    expect(blockForLicense(weird)).toEqual({ kind: 'license', status: 'unverified' });
  });
});

describe('پیام‌ها', () => {
  const all: SiteBlock[] = [
    { kind: 'domain' },
    { kind: 'db' },
    { kind: 'license', serviceDown: true },
    { kind: 'license', status: 'unverified' },
    { kind: 'license', status: 'inactive' },
    { kind: 'license', status: 'suspended' },
    { kind: 'license', status: 'expired' },
    { kind: 'license', status: 'unknown' },
  ];

  it('پیام «ثبت نشده» فقط برای license:unknown است', () => {
    for (const block of all) {
      const isUnknown = block.kind === 'license' && block.status === 'unknown';
      expect(blockCopy(block).title.includes(NOT_REGISTERED)).toBe(isUnknown);
    }
  });

  it('دامنه‌ی شناسایی‌نشده راهنمای Host/SHOP_DOMAIN دارد', () => {
    const copy = blockCopy({ kind: 'domain' });
    expect(copy.code).toBe('domain');
    expect(copy.hint).toContain('SHOP_DOMAIN');
  });

  it('دیتابیس آماده‌نشده به provision/volume ارجاع می‌دهد', () => {
    const copy = blockCopy({ kind: 'db' });
    expect(copy.code).toBe('db');
    expect(copy.body).toContain('دیتابیس');
    expect(copy.hint).toContain('ready');
  });

  it('قطع سرویس Core پیام مخصوص خودش را دارد', () => {
    const copy = blockCopy({ kind: 'license', serviceDown: true });
    expect(copy.title).toBe('سرویس موقتاً در دسترس نیست');
  });

  it('دیتابیس pending پیام اختصاصی دارد', () => {
    expect(DB_PENDING_COPY.code).toBe('db:pending');
    expect(DB_PENDING_COPY.title.includes(NOT_REGISTERED)).toBe(false);
    expect(DB_PENDING_COPY.body.includes('دیتابیس')).toBe(true);
  });

  it('ورود مستقیم با فروشگاه سالم پیام بی‌طرف دارد', () => {
    expect(DIRECT_COPY.code).toBe('direct');
    expect(DIRECT_COPY.title.includes(NOT_REGISTERED)).toBe(false);
    expect(DIRECT_COPY.body.includes('پیدا نشد')).toBe(false);
  });
});

describe('blockCode', () => {
  it('کد یکتای هر دلیل', () => {
    const pairs: [SiteBlock, string][] = [
      [{ kind: 'domain' }, 'domain'],
      [{ kind: 'db' }, 'db'],
      [{ kind: 'license', serviceDown: true }, 'license:down'],
      [{ kind: 'license', status: 'suspended' }, 'license:suspended'],
      [{ kind: 'license' }, 'license:unverified'],
    ];
    for (const [block, expected] of pairs) {
      expect(blockCode(block)).toBe(expected);
    }
  });
});

describe('query انتقال دلیل', () => {
  it('رفت‌وبرگشت همه‌ی دلیل‌ها', () => {
    const blocks: SiteBlock[] = [
      { kind: 'domain' },
      { kind: 'db' },
      { kind: 'license', serviceDown: true },
      { kind: 'license', status: 'unknown' },
      { kind: 'license', status: 'expired' },
    ];
    for (const block of blocks) {
      expect(blockFromQuery(blockSearchParams(block))).toEqual(block);
    }
  });

  it('ورودی نامعتبر query دلیل نمی‌سازد', () => {
    expect(blockFromQuery({})).toBeNull();
    expect(blockFromQuery({ reason: 'whatever' })).toBeNull();
  });

  it('reason=license بدون وضعیت = قابل تأیید نیست', () => {
    const block = blockFromQuery({ reason: 'license' });
    expect(block).toEqual({ kind: 'license', status: 'unverified' });
  });
});
