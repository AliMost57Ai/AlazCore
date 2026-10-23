/**
 * @jest-environment node
 *
 * تست مایگریشن داده‌محفوظ دیتابیس‌های سایت (lib/site-migrations.ts) — روی
 * دیتابیس SQLite موقت: اعمال 0001 گارددار روی schema تجمعی، افزودن مایگریشن
 * جدید بدون از دست رفتن داده، idempotency، و markAll برای دیتابیس نو.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrismaClient } from './generated/prisma/client';
import { createPrismaClient } from './prisma-adapter';

let tempDir: string;
let dbPath: string;
let prisma: PrismaClient;

beforeAll(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'site-migrations-test-'));
  process.env.SITE_MIGRATIONS_DIR = path.join(tempDir, 'migrations');
  mkdirSync(process.env.SITE_MIGRATIONS_DIR, { recursive: true });
  writeFileSync(
    path.join(process.env.SITE_MIGRATIONS_DIR, '0001_baseline_light_migrations.sql'),
    readFileSync(
      path.join(process.cwd(), 'prisma', 'site-migrations', '0001_baseline_light_migrations.sql'),
      'utf8'
    )
  );
  dbPath = path.join(tempDir, 'site.db');
  prisma = createPrismaClient(`file:${dbPath.replace(/\\/g, '/')}`);
});

afterAll(async () => {
  await prisma.$disconnect();
  delete process.env.SITE_MIGRATIONS_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

/** schema تجمعی (site-schema.sql) را روی دیتابیس موقت اعمال می‌کند. */
async function applyCumulativeSchema(): Promise<void> {
  const { parseMigrationScript } = await import('./site-migrations');
  const sql = readFileSync(path.join(process.cwd(), 'prisma', 'site-schema.sql'), 'utf8');
  for (const statement of parseMigrationScript(sql)) {
    await prisma.$executeRawUnsafe(statement.sql);
  }
}

async function ledgerNames(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    'SELECT "name" FROM "_SiteMigration" ORDER BY "name"'
  );
  return rows.map((row) => row.name);
}

describe('parseMigrationScript', () => {
  it('گاردها را به دستور بعدی می‌چسباند و کامنت‌های ساده را نادیده می‌گیرد', async () => {
    const { parseMigrationScript } = await import('./site-migrations');
    const statements = parseMigrationScript(
      [
        '-- توضیح معمولی',
        '-- @if-no-column Product.nickname',
        'ALTER TABLE "Product" ADD COLUMN "nickname" TEXT;',
        '',
        'CREATE INDEX IF NOT EXISTS "x" ON "Product"("id");',
      ].join('\n')
    );
    expect(statements).toHaveLength(2);
    expect(statements[0].guard).toEqual({ kind: 'column', table: 'Product', column: 'nickname' });
    expect(statements[0].sql).toBe('ALTER TABLE "Product" ADD COLUMN "nickname" TEXT;');
    expect(statements[1].guard).toBeUndefined();
  });

  it('دستور بدون ; انتهایی هم گرفته می‌شود', async () => {
    const { parseMigrationScript } = await import('./site-migrations');
    const statements = parseMigrationScript('SELECT 1');
    expect(statements).toHaveLength(1);
    expect(statements[0].sql).toBe('SELECT 1');
  });
});

describe('applyPendingSiteMigrations — جریان واقعی', () => {
  it('0001 گارددار روی schema تجمعی فقط ثبت می‌شود و داده سالم می‌ماند', async () => {
    await applyCumulativeSchema();
    await prisma.user.create({
      data: { name: 'مالک', email: 'admin@shop2.ir', role: 'admin', salt: 's', passwordHash: 'h' },
    });

    const { applyPendingSiteMigrations } = await import('./site-migrations');
    const applied = await applyPendingSiteMigrations(prisma);
    expect(applied).toEqual(['0001_baseline_light_migrations.sql']);
    expect(await ledgerNames()).toEqual(['0001_baseline_light_migrations.sql']);

    // اجرای مجدد = هیچ
    expect(await applyPendingSiteMigrations(prisma)).toEqual([]);

    // ساخت مایگریشن جدید → ستون اضافه می‌شود و ردیف قبلی حفظ می‌شود.
    writeFileSync(
      path.join(process.env.SITE_MIGRATIONS_DIR!, '0002_add_nickname.sql'),
      ['-- @if-no-column User.nickname', 'ALTER TABLE "User" ADD COLUMN "nickname" TEXT;'].join(
        '\n'
      )
    );
    const second = await applyPendingSiteMigrations(prisma);
    expect(second).toEqual(['0002_add_nickname.sql']);

    const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@shop2.ir' } });
    expect(owner.name).toBe('مالک');
    const columns = await prisma.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM pragma_table_info('User') WHERE name = 'nickname'"
    );
    expect(columns).toHaveLength(1);
    expect(await ledgerNames()).toEqual([
      '0001_baseline_light_migrations.sql',
      '0002_add_nickname.sql',
    ]);

    // idempotent بودن مایگریشن جدید (حذف ledger، اجرای دوباره با گارد)
    await prisma.$executeRawUnsafe(
      'DELETE FROM "_SiteMigration" WHERE name = ?',
      '0002_add_nickname.sql'
    );
    expect(await applyPendingSiteMigrations(prisma)).toEqual(['0002_add_nickname.sql']);
    const ownerAfter = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@shop2.ir' } });
    expect(ownerAfter.name).toBe('مالک');
  });

  it('markAllSiteMigrationsApplied دیتابیس نو را «به‌روز» ثبت می‌کند', async () => {
    const fresh = createPrismaClient(`file:${path.join(tempDir, 'fresh.db').replace(/\\/g, '/')}`);
    try {
      const { markAllSiteMigrationsApplied, applyPendingSiteMigrations } = await import(
        './site-migrations'
      );
      await markAllSiteMigrationsApplied(fresh);
      const rows = await fresh.$queryRawUnsafe<{ name: string }[]>(
        'SELECT "name" FROM "_SiteMigration"'
      );
      expect(rows.map((row) => row.name)).toContain('0001_baseline_light_migrations.sql');
      expect(await applyPendingSiteMigrations(fresh)).toEqual([]);
    } finally {
      await fresh.$disconnect();
    }
  });
});
