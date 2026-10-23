/**
 * دیتابیس اختصاصی هر سایت — multi-tenant روی SQLite.
 *
 * برای هر دامنه‌ی ثبت‌شده یک پوشه و یک فایل دیتابیس ساخته می‌شود:
 *   data/sites/{sanitized}/{sanitized}.db
 * (نام دقیق، هنگام ثبت دامنه در پنل Core به‌عنوان dbName ثبت و نمایش داده
 * می‌شود؛ rename دامنه، دیتابیس موجود را جابه‌جا نمی‌کند.)
 *
 * ساخت دیتابیس جدید فقط در توسعه on-demand است (allowCreate)؛ در production
 * دیتابیس فقط با ثبت دامنه در پنل Core ساخته می‌شود و نبودِ فایل یعنی
 * null/خطا — **هرگز fallback به دیتابیس اصلی** (fail-closed).
 *
 * ensureSiteDb() مطمئن می‌شود پوشه/فایل/schema/مایگریشن‌ها/حساب ادمین آماده
 * است — idempotent و با قفل promise تا درخواست‌های موازی دوبار provision
 * نکنند. پنل Core هم هنگام ثبت دامنه همین کار را انجام می‌دهد؛ اینجا اگر
 * فایل هست، مایگریشن‌های pending و ادمین پیش‌فرض تکمیل می‌شوند.
 */

import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from './generated/prisma/client';
import { createPrismaClient } from './prisma-adapter';
import { applyPendingSiteMigrations, markAllSiteMigrationsApplied } from './site-migrations';
import { isProductionRuntime, siteFromContext } from './site-runtime';

/** salt/hash ادمین پیش‌فرض (admin1234) — همان قالب seed فروشگاه؛ پنل Core هم برای provision از همین قالب INSERT می‌کند. */
export const ADMIN_SALT = 'a0e14961bffc14ec33396dc5a8eb3042';
export const ADMIN_HASH = '321573d869d4539cbccff6250f24e7378e2616543d5cec5310f483197d8cdd99';

/**
 * در production وقتی دیتابیس دامنه موجود نیست (ثبت‌نشده/pending) — به‌جای
 * fallback به app.db پرتاب می‌شود تا هیچ داده‌ای بین سایت‌ها قاطی نشود.
 */
export class SiteUnavailableError extends Error {
  constructor(domain: string) {
    super(`دیتابیس سایت ${domain} آماده نیست — دامنه ثبت/provision نشده است.`);
    this.name = 'SiteUnavailableError';
  }
}

const globalForSites = globalThis as unknown as {
  siteClients?: Map<string, PrismaClient>;
  sitePending?: Map<string, Promise<PrismaClient | null>>;
};

if (!globalForSites.siteClients) {
  globalForSites.siteClients = new Map();
}
if (!globalForSites.sitePending) {
  globalForSites.sitePending = new Map();
}
const clients: Map<string, PrismaClient> = globalForSites.siteClients;
const pending: Map<string, Promise<PrismaClient | null>> = globalForSites.sitePending;

/** نام پوشه/فایل امن برای یک دامنه. */
export function sanitizeSiteDir(domain: string): string {
  return (
    domain
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 64) || 'site'
  );
}

/** مسیر نسبی دیتابیس سایت — همان چیزی که در پنل Core نمایش داده می‌شود. */
export function siteDbRelativePath(domain: string): string {
  const dir = sanitizeSiteDir(domain);
  return `data/sites/${dir}/${dir}.db`;
}

/** ریشه‌ی داده‌ی اختصاصی سایت (data/sites/{dir}) — آپلودها زیر همین هستند. */
export function siteDataDir(domain: string): string {
  return path.join('data', 'sites', sanitizeSiteDir(domain));
}

/**
 * ریشه‌ی داده‌ی سایتِ فعالِ کانتکست (sync) — data/sites/{dir} وقتی کانتکست
 * سایت هست، وگرنه data/ (دیتابیس اصلی dev/اسکریپت‌ها). مسیر آپلودها با همین
 * تفکیک می‌شود تا فایل‌های سایت‌ها قاطی نشوند.
 */
export function activeDataDir(): string {
  const domain = siteFromContext();
  return domain ? siteDataDir(domain) : 'data';
}

function siteDbAbsolutePath(domain: string): string {
  return path.join(process.cwd(), siteDbRelativePath(domain));
}

/** آیا فایل دیتابیس این دامنه روی دیسک موجود است (گیت fail-closed پراکسی). */
export function siteDbFileExists(domain: string): boolean {
  return existsSync(siteDbAbsolutePath(domain));
}

/** DDL اسکیمای فروشگاه (تولیدشده با prisma migrate diff — آرتیفکت کامیت‌شده). */
function readShopSchemaSql(): string | null {
  try {
    return readFileSync(path.join(process.cwd(), 'prisma', 'site-schema.sql'), 'utf8');
  } catch {
    return null;
  }
}

/** شکستن اسکریپت SQL به دستورها — کامنت‌ها حذف و روی ;ِ انتهای خط بریده می‌شود. */
function splitSqlStatements(script: string): string[] {
  const withoutComments = script
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  return withoutComments
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

/**
 * کلاینت Prisma دیتابیس اصلی (خارج از کانتکست سایت) — برای dev بدون دامنه
 * و اسکریپت‌ها. همان singleton قبلی lib/db.ts.
 */
export function mainClient(): PrismaClient {
  return mainSingleton;
}

const globalForMain = globalThis as unknown as { prisma?: PrismaClient };
const mainSingleton = globalForMain.prisma ?? createPrismaClient();

/**
 * ساخت ادمین پیش‌فرض هر سایت (admin@{دامنه} با رمز admin1234) — idempotent.
 * همزمان شبکه‌ی ایمنی سایت‌های قدیمی است که provision شان پیش از افزودن
 * seeding سمت کور انجام شده؛ صفحه‌ی اعتبارنامه‌ی پنل Core هم با همین قالب
 * کار می‌کند (app/api/core/site-admin).
 */
export async function bootstrapSiteAdmin(client: PrismaClient, domain: string): Promise<void> {
  const adminEmail = `admin@${domain}`;
  const hasAdmin = await client.user.findUnique({ where: { email: adminEmail } });
  if (!hasAdmin) {
    await client.user.create({
      data: {
        name: 'مدیر فروشگاه',
        email: adminEmail,
        role: 'admin',
        salt: ADMIN_SALT,
        passwordHash: ADMIN_HASH,
      },
    });
  }
}

/**
 * آماده‌سازی (در صورت نیاز) و بازگرداندن کلاینت دیتابیس یک سایت.
 * اگر فایل نبود: در توسعه mkdir + اعمال schema؛ در production (allowCreate
 * نبود) null — fail-closed. اگر جداول خالی بود: schema تجمعی + ثبت نسخه؛
 * وگرنه مایگریشن‌های pending داده‌محفوظ (lib/site-migrations.ts). در همه‌ی
 * حالت‌ها ادمین پیش‌فرض bootstrap می‌شود (بدون داده دمو — تصمیم کاربر).
 */
export async function ensureSiteDb(
  domain: string,
  opts: { allowCreate?: boolean } = {}
): Promise<PrismaClient | null> {
  const existing = clients.get(domain);
  if (existing) {
    return existing;
  }
  const inFlight = pending.get(domain);
  if (inFlight) {
    return inFlight;
  }

  const task = (async (): Promise<PrismaClient | null> => {
    const absPath = siteDbAbsolutePath(domain);
    if (!existsSync(absPath)) {
      if (opts.allowCreate !== true) {
        return null;
      }
      const dir = path.dirname(absPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }

    const url = `file:${absPath.replace(/\\/g, '/')}`;
    const client = createPrismaClient(url);

    // اسکیمای فروشگاه را روی دیتابیس سایت اعمال کن — پرایسما خودش فایل را
    // می‌سازد؛ اعمال DDL وقتی لازم است که جدول User وجود ندارد (فایل تازه یا
    // خالیِ ساخته‌شده توسط Core).
    const table = await client.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'User'"
    );
    if (table.length === 0) {
      const sql = readShopSchemaSql();
      if (!sql) {
        throw new Error('prisma/site-schema.sql یافت نشد — provision ناتمام ماند.');
      }
      for (const statement of splitSqlStatements(sql)) {
        await client.$executeRawUnsafe(statement);
      }
      // schema تجمعی همه‌ی فایل‌های مایگریشن را پوشش می‌دهد — ledger کامل ثبت شود.
      await markAllSiteMigrationsApplied(client);
    } else {
      // مایگریشن‌های pending فایل‌محور و داده‌محفوظ — 0001 گارددار است و روی
      // دیتابیس‌های قدیمیِ از قبل ارتقایافته هم idempotent می‌ماند.
      await applyPendingSiteMigrations(client);
    }

    await bootstrapSiteAdmin(client, domain);

    clients.set(domain, client);
    return client;
  })();

  pending.set(domain, task);
  try {
    return await task;
  } finally {
    pending.delete(domain);
  }
}

/** کلاینت sync یک دامنه — از کش، یا ساخت sync وقتی فایل دیتابیس موجود است. */
export function clientForDomain(domain: string): PrismaClient | null {
  const cached = clients.get(domain);
  if (cached) {
    return cached;
  }
  // اگر فایل دیتابیس از قبل (توسط Core یا اجرای قبلی) آماده است، کلاینت را
  // sync بساز — bootstrap async بعداً توسط prewarm کاملش می‌کند.
  const absPath = siteDbAbsolutePath(domain);
  if (existsSync(absPath)) {
    const client = createPrismaClient(`file:${absPath.replace(/\\/g, '/')}`);
    clients.set(domain, client);
    void ensureSiteDb(domain, { allowCreate: !isProductionRuntime() }).catch(() => {});
    return client;
  }
  // فایل هنوز ساخته نشده — prewarm (proxy/ensureSiteContext) در جریان است.
  return null;
}

/** کلاینت sync کانتکست فعلی — فقط lib/db.ts مصرفش می‌کند. */
export function siteClientSync(): PrismaClient | null {
  const domain = siteFromContext();
  return domain ? clientForDomain(domain) : null;
}
