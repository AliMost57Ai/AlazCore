/**
 * تولید فایل مایگریشن دیتابیس‌های سایت — بعد از هر تغییر prisma/schema.prisma:
 *
 *   npx tsx scripts/new-site-migration.ts <نام-کوتاه>   // مثل add-wallet
 *
 * کاری که می‌کند:
 *  ۱) یک دیتابیس موقت SQLite از `prisma/site-schema.sql` (وضعیت تجمعی فعلی)
 *     می‌سازد؛
 *  ۲) با `prisma migrate diff` تفاوت آن با schema جدید را به SQL افزایشی
 *     درمی‌آورد و در `prisma/site-migrations/NNNN_نام.sql` می‌نویسد؛
 *  ۳) `prisma/site-schema.sql` را از schema جدید بازتولید می‌کند (وضعیت
 *     تجمعی برای provision دیتابیس‌های نو)؛
 *  ۴) اگر دستور مخربی (DROP و…) در diff باشد هشدار می‌دهد — مایگریشن مخرب
 *     را قبل از کامیت دستی بازبینی/تعدیل کنید.
 *
 * اعمال: در Docker، entrypoint خودش `scripts/migrate-sites.ts` را قبل از
 * next start اجرا می‌کند؛ محلی هم همان اسکریپت را دستی بزنید.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPrismaClient } from '../lib/prisma-adapter';
import { parseMigrationScript } from '../lib/site-migrations';

const MIGRATIONS_DIR = path.join('prisma', 'site-migrations');
const SCHEMA_PRISMA = path.join('prisma', 'schema.prisma');
const SITE_SCHEMA_SQL = path.join('prisma', 'site-schema.sql');

const require = createRequire(import.meta.url);

function runPrisma(args: string[]): string {
  // npx.cmd روی Node جدید ویندوز EINVAL می‌دهد — مستقیم با node و باینری
  // محلی prisma صدا زده می‌شود تا هم Git Bash و هم cmd کار کنند.
  const prismaCli = require.resolve('prisma/build/index.js');
  return execFileSync(process.execPath, [prismaCli, ...args], { encoding: 'utf8' });
}

function nextIndex(): number {
  let max = 0;
  for (const file of readdirSync(MIGRATIONS_DIR)) {
    const match = file.match(/^(\d{4})_/);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return max + 1;
}

function destructiveStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) =>
      /^(DROP\s+(TABLE|INDEX|COLUMN)|CREATE\s+OR\s+REPLACE|ALTER\s+TABLE\s+".*"\s+DROP)/i.test(
        statement
      )
    );
}

async function main(): Promise<void> {
  const name = process.argv[2];
  if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    console.error(
      'نام مایگریشن بدهید (kebab-case): npx tsx scripts/new-site-migration.ts add-wallet'
    );
    process.exit(1);
  }
  if (!readFileSync(SCHEMA_PRISMA, 'utf8').includes('provider = "sqlite"')) {
    console.error('این اسکریپت برای schema فعلی (sqlite) نوشته شده است.');
    process.exit(1);
  }

  // دیتابیس موقت از وضعیت تجمعی فعلی — مبنای from در diff.
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'alazcore-site-migration-'));
  const tmpDb = path.join(tmpDir, 'base.db');
  const tmpUrl = `file:${tmpDb.replace(/\\/g, '/')}`;
  const base = createPrismaClient(tmpUrl);
  try {
    const cumulative = readFileSync(SITE_SCHEMA_SQL, 'utf8');
    for (const statement of parseMigrationScript(cumulative)) {
      await base.$executeRawUnsafe(statement.sql);
    }
  } finally {
    await base.$disconnect();
  }

  let diff = '';
  try {
    diff = runPrisma([
      'migrate',
      'diff',
      '--from-url',
      tmpUrl,
      '--to-schema-datamodel',
      SCHEMA_PRISMA.replace(/\\/g, '/'),
      '--script',
    ]).trim();
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  if (!diff) {
    console.log('تفاوتی بین site-schema.sql و schema.prisma نیست — مایگریشنی لازم نیست.');
    return;
  }

  const destructive = destructiveStatements(diff);
  const index = String(nextIndex()).padStart(4, '0');
  const fileName = `${index}_${name}.sql`;
  const header = [
    `-- مایگریشن ${fileName} — تولیدشده با scripts/new-site-migration.ts (${new Date().toISOString()}).`,
    '-- اجرا: هر دیتابیس سایت یک بار (ledger _SiteMigration)؛ تراکنشی و idempotent.',
    '',
  ].join('\n');
  writeFileSync(path.join(MIGRATIONS_DIR, fileName), `${header}${diff}\n`, 'utf8');

  // وضعیت تجمعی را از schema جدید بازتولید کن — همان فرمان مستند DEPLOY-CORE.md.
  const cumulativeNew = runPrisma([
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema-datamodel',
    SCHEMA_PRISMA.replace(/\\/g, '/'),
    '--script',
  ]);
  writeFileSync(SITE_SCHEMA_SQL, cumulativeNew, 'utf8');

  console.log(
    `✅ ${MIGRATIONS_DIR}${path.sep}${fileName} ساخته شد و ${SITE_SCHEMA_SQL} بازتولید شد.`
  );
  if (destructive.length > 0) {
    console.warn('\n⚠️  دستورهای مخرب در این مایگریشن هست — قبل از کامیت بازبینی کنید:');
    for (const statement of destructive) {
      console.warn(`   ${statement.slice(0, 100)}`);
    }
  }
  console.log('\nقدم بعدی:');
  console.log('  - محلی:      npx tsx scripts/migrate-sites.ts');
  if (existsSync(path.join('docker', 'entrypoint.sh'))) {
    console.log('  - سرور:      entrypoint داکر خودش قبل از next start اعمال می‌کند.');
  }
}

main().catch((error: unknown) => {
  console.error('خطا در تولید مایگریشن:', error);
  process.exit(1);
});
