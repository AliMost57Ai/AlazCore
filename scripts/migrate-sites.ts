/**
 * اعمال مایگریشن‌های pending روی همه‌ی دیتابیس‌های سایت — داده‌محفوظ.
 *
 *   npx tsx scripts/migrate-sites.ts
 *
 * همه‌ی فایل‌های دیتابیس سایت‌ها (زیر data/sites/{دامنه}) را پیدا و
 * مایگریشن‌های اعمال‌نشده را طبق ledger داخلی (_SiteMigration) روی هر کدام
 * اجرا می‌کند. در Docker توسط entrypoint قبل از next start صدا زده می‌شود
 * (هر پابلیش = به‌روز شدن همه‌ی سایت‌ها) و محلی/سرور هم دستی قابل اجراست.
 */

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '../lib/prisma-adapter';
import { applyPendingSiteMigrations } from '../lib/site-migrations';

function siteDbFiles(): string[] {
  const sitesDir = path.join(process.cwd(), 'data', 'sites');
  // بوت اول روی volume تازه هنوز data/sites وجود ندارد — نه مایگریشن‌ای هست نه خطا
  if (!existsSync(sitesDir)) {
    return [];
  }
  const files: string[] = [];
  for (const entry of readdirSync(sitesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const dir = path.join(sitesDir, entry.name);
    for (const file of readdirSync(dir)) {
      if (file.endsWith('.db')) {
        files.push(path.join(dir, file));
      }
    }
  }
  return files;
}

async function main(): Promise<void> {
  const files = siteDbFiles();
  if (files.length === 0) {
    console.log('دیتابیس سایتی پیدا نشد (data/sites/*/*.db) — کاری نیست.');
    return;
  }

  let failed = 0;
  for (const file of files) {
    const url = `file:${file.replace(/\\/g, '/')}`;
    const client = createPrismaClient(url);
    try {
      const applied = await applyPendingSiteMigrations(client);
      const rel = path.relative(process.cwd(), file);
      if (applied.length > 0) {
        console.log(`✅ ${rel}: ${applied.join(', ')} اعمال شد.`);
      } else {
        console.log(`✔  ${rel}: به‌روز است.`);
      }
    } catch (error) {
      failed += 1;
      console.error(`❌ ${path.relative(process.cwd(), file)}:`, (error as Error).message);
    } finally {
      await client.$disconnect();
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} دیتابیس شکست خورد — لاگ بالا را ببینید.`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('خطا در مایگریشن سایت‌ها:', error);
  process.exit(1);
});
