/**
 * پروویژن دیتابیس اختصاصی هر سایت فروشگاهی — هنگام ثبت دامنه در پنل Core
 * اجرا می‌شود: پوشه data/sites/{dir}/{dir}.db در ریشه‌ی اپ فروشگاه ساخته،
 * schema تجمعی فروشگاه (prisma/site-schema.sql) اعمال، ledger مایگریشن‌ها
 * تکمیل و **حساب ادمین پیش‌فرض (admin@{دامنه} / admin1234) همان‌جا ساخته
 * می‌شود** — تا از لحظه‌ی ثبت دامنه، ورود مالک ممکن باشد و اعتبارنامه در
 * صفحه‌ی دامنه نمایش داده شود (app/api/domains/[id]/site-admin).
 *
 * دیتابیس نو اول در فایل موقت ساخته می‌شود و با rename اتمیک سر جای نهایی
 * می‌نشیند تا فروشگاه وسط کار فایل ناقص نبیند.
 *
 * مسیر اپ فروشگاه با SHOP_APP_ROOT (پیش‌فرض: پوشه‌ی والد اپ Core — همان
 * مونوریپو dev) پیدا می‌شود. در دیپلوی جدا، SHOP_APP_ROOT را روی مسیر اپ
 * فروشگاه همان سرور تنظیم کنید؛ شکست provision، دامنه را 'pending' می‌گذارد
 * تا بعداً دوباره تلاش شود — ثبت دامنه هیچ‌وقت به‌خاطر آن شکست نمی‌خورد.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { PrismaClient } from './generated/prisma/client';
import { createPrismaClient } from './prisma-adapter';

/**
 * salt/hash ادمین پیش‌فرض (admin1234) — قرارداد مشترک با lib/site-db.ts
 * فروشگاه (bootstrapSiteAdmin)؛ تغییر فقط هم‌زمان در هر دو سمت.
 */
const ADMIN_SALT = 'a0e14961bffc14ec33396dc5a8eb3042';
const ADMIN_HASH = '321573d869d4539cbccff6250f24e7378e2616543d5cec5310f483197d8cdd99';

/** همان DDLLedger سمت فروشگاه (lib/site-migrations.ts) — هماهنگ تغییر می‌کند. */
const SITE_MIGRATION_LEDGER_DDL =
  'CREATE TABLE IF NOT EXISTS "_SiteMigration" ("name" TEXT NOT NULL PRIMARY KEY, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)';

export function sanitizeSiteDir(domain: string): string {
  return (
    domain
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 64) || 'site'
  );
}

export function siteDbRelativePath(domain: string): string {
  const dir = sanitizeSiteDir(domain);
  return `data/sites/${dir}/${dir}.db`;
}

function shopRoot(): string {
  return path.resolve(process.cwd(), process.env.SHOP_APP_ROOT ?? '..');
}

/** DDL اسکیمای فروشگاه — از ریشه‌ی اپ فروشگاه (SHOP_APP_ROOT) خوانده می‌شود. */
function readShopSchemaSql(): string | null {
  try {
    return readFileSync(path.join(shopRoot(), 'prisma', 'site-schema.sql'), 'utf8');
  } catch {
    return null;
  }
}

/** نام فایل‌های مایگریشن فروشگاه — برای علامت‌گذاری دیتابیس نو به‌عنوان به‌روز. */
function listShopMigrationNames(): string[] {
  try {
    return readdirSync(path.join(shopRoot(), 'prisma', 'site-migrations'))
      .filter((file) => file.endsWith('.sql'))
      .sort();
  } catch {
    return [];
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

export interface ProvisionResult {
  dbName: string;
  status: 'ready' | 'pending';
  detail?: string;
}

/** ساخت ادمین پیش‌فرض سایت (idempotent — ایمیل یونیک، INSERT OR IGNORE). */
async function seedSiteAdmin(client: PrismaClient, domain: string): Promise<void> {
  await client.$executeRawUnsafe(
    'INSERT OR IGNORE INTO "User" ("id", "name", "email", "role", "salt", "passwordHash") VALUES (?, ?, ?, ?, ?, ?)',
    randomUUID(),
    'مدیر فروشگاه',
    `admin@${domain}`,
    'admin',
    ADMIN_SALT,
    ADMIN_HASH
  );
}

/** ساخت پوشه/دیتابیس سایت و اعمال schema فروشگاه + ادمین پیش‌فرض (idempotent). */
export async function provisionSiteDb(domain: string): Promise<ProvisionResult> {
  const dbName = siteDbRelativePath(domain);
  const root = shopRoot();
  const absPath = path.join(root, dbName);
  const dir = path.dirname(absPath);

  try {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const sql = readShopSchemaSql();
    if (!sql) {
      return { dbName, status: 'pending', detail: 'prisma/site-schema.sql در اپ فروشگاه یافت نشد.' };
    }

    // فایل نهایی از قبل هست (provision مجدد/دامنه‌ی pending بعد از ساخت دستی) —
    // همان مسیر idempotent قبلی: فقط در صورت نبودِ جداول، schema اعمال می‌شود.
    const target = existsSync(absPath)
      ? absPath
      : `${absPath}.tmp-provision`;
    const url = `file:${target.replace(/\\/g, '/')}`;
    const client = createPrismaClient(url);
    try {
      const table = await client.$queryRawUnsafe<{ name: string }[]>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'User'"
      );
      if (table.length === 0) {
        for (const statement of splitSqlStatements(sql)) {
          await client.$executeRawUnsafe(statement);
        }
      }
      // دیتابیس نو schema تجمعی دارد — همه‌ی مایگریشن‌ها را «اعمال‌شده» ثبت کن
      // تا migrate-sites بعدی (entrypoint/fallback) رویش کاری نکند. برای
      // دیتابیس موجود هم ردیف‌های جاافتانه completes می‌شود (INSERT OR IGNORE).
      await client.$executeRawUnsafe(SITE_MIGRATION_LEDGER_DDL);
      for (const name of listShopMigrationNames()) {
        await client.$executeRawUnsafe(
          'INSERT OR IGNORE INTO "_SiteMigration" ("name") VALUES (?)',
          name
        );
      }
      await seedSiteAdmin(client, domain);
    } finally {
      await client.$disconnect();
    }

    // rename اتمیک — فروشگاه هیچ‌وقت فایل نیمه‌ساخته نمی‌بیند.
    if (target !== absPath) {
      await rename(target, absPath);
    }
    return { dbName, status: 'ready' };
  } catch (error) {
    return { dbName, status: 'pending', detail: (error as Error).message };
  }
}

/** تلاش مجدد برای دامنه‌های pending — از صفحه دامین‌ها قابل فراخوانی است. */
export async function ensureProvisioned(
  domain: string,
  current: { dbName: string | null; dbStatus: string | null }
): Promise<ProvisionResult> {
  if (current.dbName && current.dbStatus === 'ready') {
    return { dbName: current.dbName, status: 'ready' };
  }
  return provisionSiteDb(domain);
}
