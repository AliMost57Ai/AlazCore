/**
 * مایگریشن داده‌محفوظ دیتابیس‌های سایت — بین پابلیش‌ها بدون از دست رفتن داده.
 *
 * جریان: تغییر `prisma/schema.prisma` در توسعه → `npx tsx scripts/new-site-migration.ts
 * <نام>` فایل `prisma/site-migrations/NNNN_نام.sql` می‌سازد (diff افزایشی).
 * اعمال‌کننده‌ی همین ماژول فایل‌های pending را روی هر دیتابیس سایت اجرا می‌کند:
 *  - `scripts/migrate-sites.ts` در entrypoint داکر (قبل از next start) — همه‌ی
 *    دیتابیس‌ها یک‌جا؛ روی سرور هم به‌صورت دستی قابل اجراست؛
 *  - fallback داخل `ensureSiteDb` — هر دامنه‌ای که از قلم افتاد در اولین تماس.
 * هر فایل در یک تراکنش SQLite اجرا و در جدول `_SiteMigration` ثبت می‌شود؛
 * اجرای مجدد بی‌اثر است (idempotent).
 *
 * گاردهای اختیاری داخل فایل SQL (برای مایگریشن پایه که روی دیتابیس‌های قدیمی
 *ِ از قبل ارتقایافته هم اعمال می‌شود):
 *   -- @if-no-column Table.Column   → دستور بعدی فقط اگر ستون نباشد
 *   -- @if-no-table Table           → دستور بعدی فقط اگر جدول نباشد
 *   -- @if-no-index IndexName       → دستور بعدی فقط اگر ایندکس نباشد
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Prisma, PrismaClient } from './generated/prisma/client';

const MIGRATIONS_DIR = process.env.SITE_MIGRATIONS_DIR
  ? path.resolve(process.env.SITE_MIGRATIONS_DIR)
  : path.join(process.cwd(), 'prisma', 'site-migrations');

/**
 * DDL جدول ثبت مایگریشن‌ها — اعمال‌کننده خودش موقع شروع کار می‌سازد (در
 * `prisma/site-schema.sql` نیست تا خروجی `prisma migrate diff` پایدار بماند)؛
 * `core/lib/provision.ts` هم همین قالب را می‌شناسد. تغییرش فقط با هماهنگی
 * هر دو سمت.
 */
export const SITE_MIGRATION_LEDGER_DDL =
  'CREATE TABLE IF NOT EXISTS "_SiteMigration" ("name" TEXT NOT NULL PRIMARY KEY, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)';

/** نام فایل‌های مایگریشن به ترتیب اجرا — کور هم برای ثبت نسخه‌ی دیتابیس نو می‌خواندش. */
export function listSiteMigrationNames(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

type Guard =
  | { kind: 'column'; table: string; column: string }
  | { kind: 'table'; name: string }
  | { kind: 'index'; name: string };

interface GuardedStatement {
  guard?: Guard;
  sql: string;
}

const GUARD_DIRECTIVE = /^--\s*@if-no-(column|table|index)\s+([A-Za-z0-9_.[\]]+)\s*$/;
const IDENT = /^[A-Za-z0-9_]+$/;

function parseGuard(kind: string, target: string): Guard | undefined {
  const clean = target.replace(/[[\]"]/g, '');
  if (kind === 'column') {
    const [table, column] = clean.split('.');
    if (!table || !column || !IDENT.test(table) || !IDENT.test(column)) {
      throw new Error(`گارد نامعتبر @if-no-column: ${target}`);
    }
    return { kind: 'column', table, column };
  }
  if (!IDENT.test(clean)) {
    throw new Error(`گارد نامعتبر @if-no-${kind}: ${target}`);
  }
  return kind === 'table' ? { kind: 'table', name: clean } : { kind: 'index', name: clean };
}

/** شکستن اسکریپت به دستورهای گارددار — کامنت‌های گارد بلافاصله قبل از دستور. */
export function parseMigrationScript(content: string): GuardedStatement[] {
  const statements: GuardedStatement[] = [];
  let guard: Guard | undefined;
  let lines: string[] = [];

  const flush = () => {
    const sql = lines.join('\n').trim();
    if (sql) {
      statements.push({ guard, sql });
    }
    guard = undefined;
    lines = [];
  };

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('--')) {
      const directive = line.match(GUARD_DIRECTIVE);
      if (directive) {
        flush();
        guard = parseGuard(directive[1], directive[2]);
      }
      continue;
    }
    lines.push(rawLine);
    if (line.endsWith(';')) {
      flush();
    }
  }
  flush();
  return statements;
}

/** true = هدف موجود نیست و دستور باید اجرا شود. نام‌ها از فایل کامیت‌شده می‌آیند. */
async function guardSatisfied(client: PrismaClient, guard: Guard): Promise<boolean> {
  if (guard.kind === 'column') {
    const rows = await client.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM pragma_table_info('${guard.table}') WHERE name = ?`,
      guard.column
    );
    return rows.length === 0;
  }
  const rows = await client.$queryRawUnsafe<{ name: string }[]>(
    'SELECT name FROM sqlite_master WHERE type = ? AND name = ?',
    guard.kind,
    guard.name
  );
  return rows.length === 0;
}

async function appliedNames(client: PrismaClient): Promise<Set<string>> {
  const rows = await client.$queryRawUnsafe<{ name: string }[]>(
    'SELECT "name" FROM "_SiteMigration"'
  );
  return new Set(rows.map((row) => row.name));
}

/**
 * فایل‌های pending را روی دیتابیس سایت اعمال می‌کند و نام‌های اعمال‌شده را
 * برمی‌گرداند. دیتابیس نو را هم پوشش می‌دهد: فایل‌ها گارددارند و روی schema
 *ِ کاملِ `site-schema.sql` همه‌شان رد می‌شوند (idempotent).
 */
export async function applyPendingSiteMigrations(client: PrismaClient): Promise<string[]> {
  await client.$executeRawUnsafe(SITE_MIGRATION_LEDGER_DDL);
  const applied = await appliedNames(client);
  const appliedNow: string[] = [];

  for (const name of listSiteMigrationNames()) {
    if (applied.has(name)) {
      continue;
    }
    const statements = parseMigrationScript(readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8'));

    // PRAGMA داخل تراکنش بی‌اثر است — بیرون اجرا می‌شود.
    for (const statement of statements) {
      if (!statement.sql.toUpperCase().startsWith('PRAGMA')) {
        continue;
      }
      if (statement.guard && !(await guardSatisfied(client, statement.guard))) {
        continue;
      }
      await client.$executeRawUnsafe(statement.sql);
    }

    const ddl: Prisma.PrismaPromise<unknown>[] = [];
    for (const statement of statements) {
      if (statement.sql.toUpperCase().startsWith('PRAGMA')) {
        continue;
      }
      if (statement.guard && !(await guardSatisfied(client, statement.guard))) {
        continue;
      }
      ddl.push(client.$executeRawUnsafe(statement.sql));
    }
    if (ddl.length > 0) {
      await client.$transaction(ddl);
    }
    await client.$executeRawUnsafe('INSERT INTO "_SiteMigration" ("name") VALUES (?)', name);
    appliedNow.push(name);
  }
  return appliedNow;
}

/**
 * همه‌ی فایل‌های موجود را «اعمال‌شده» ثبت می‌کند — برای دیتابیس نو که schema
 * تجمعی (`site-schema.sql`) را از ابتدا دارد و نباید فایل‌ها رویش اجرا شوند.
 */
export async function markAllSiteMigrationsApplied(client: PrismaClient): Promise<void> {
  await client.$executeRawUnsafe(SITE_MIGRATION_LEDGER_DDL);
  const applied = await appliedNames(client);
  const inserts = listSiteMigrationNames()
    .filter((name) => !applied.has(name))
    .map((name) =>
      client.$executeRawUnsafe('INSERT INTO "_SiteMigration" ("name") VALUES (?)', name)
    ) satisfies Prisma.PrismaPromise<unknown>[];
  if (inserts.length > 0) {
    await client.$transaction(inserts);
  }
}
