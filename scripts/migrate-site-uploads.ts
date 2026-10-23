/**
 * مهاجرت یک‌بارهٔ فایل‌های آپلودی جابه‌جاشده — پیش از تغییر «کانتکست سایت در
 * مسیرهای آپلود» همه‌ی فایل‌ها در data/uploads اصلی می‌نشیدند (تلهٔ ALS) در
 * حالی که /api/files از دیر همین سایت می‌خواند. این اسکریپت برای هر دیتابیس
 * سایت، همه‌ی مسیرهای referenced را از جدول‌های مربوط برمی‌دارد و فایلش را —
 * اگر در data/uploads هست و در دیر سایت نیست — کپی می‌کند. Idempotent.
 *
 * اجرا: npx tsx scripts/migrate-site-uploads.ts
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '../lib/generated/prisma/client';
import { createPrismaClient } from '../lib/prisma-adapter';

const ROOT = process.cwd();
const MAIN_UPLOADS = path.join(ROOT, 'data', 'uploads');
const SITES_DIR = path.join(ROOT, 'data', 'sites');

const SETTINGS_PATH_KEYS = [
  'site_logo_path',
  'site_favicon_path',
  'site_enamad_path',
  'site_media_path',
];

/** استخراج همه‌ی مسیرهای uploads/… از یک متن JSON-مانند. */
function extractUploadPaths(text: string): string[] {
  return [...text.matchAll(/uploads\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp|avif|svg)/gi)].map(
    (match) => match[0]
  );
}

async function collectSitePaths(client: PrismaClient): Promise<Set<string>> {
  const paths = new Set<string>();

  const productImages = await client.$queryRawUnsafe<{ path: string }[]>(
    'SELECT "path" FROM "ProductImage"'
  );
  for (const row of productImages) {
    paths.add(row.path);
  }

  const brands = await client.$queryRawUnsafe<{ logoPath: string | null }[]>(
    'SELECT "logoPath" FROM "Brand" WHERE "logoPath" IS NOT NULL'
  );
  for (const row of brands) {
    paths.add(row.logoPath as string);
  }

  const messages = await client.$queryRawUnsafe<{ imagePath: string | null }[]>(
    'SELECT "imagePath" FROM "SupportTicketMessage" WHERE "imagePath" IS NOT NULL'
  );
  for (const row of messages) {
    paths.add(row.imagePath as string);
  }

  const returns = await client.$queryRawUnsafe<{ imagesJson: string; shippingReceiptPath: string | null }[]>(
    'SELECT "imagesJson", "shippingReceiptPath" FROM "ReturnRequest"'
  );
  for (const row of returns) {
    for (const found of extractUploadPaths(row.imagesJson ?? '')) {
      paths.add(found);
    }
    if (row.shippingReceiptPath) {
      paths.add(row.shippingReceiptPath);
    }
  }

  const settings = await client.$queryRawUnsafe<{ value: string }[]>(
    `SELECT "value" FROM "SiteSetting" WHERE "key" IN (${SETTINGS_PATH_KEYS.map((key) => `'${key}'`).join(',')})`
  );
  for (const row of settings) {
    if (row.value.trim()) {
      paths.add(row.value.trim());
    }
  }

  return paths;
}

async function main(): Promise<void> {
  if (!existsSync(SITES_DIR)) {
    console.log('no data/sites directory — nothing to migrate.');
    return;
  }

  const siteDirs = readdirSync(SITES_DIR).filter((dir) =>
    existsSync(path.join(SITES_DIR, dir, `${dir}.db`))
  );
  if (siteDirs.length === 0) {
    console.log('no site databases found — nothing to migrate.');
    return;
  }

  for (const dir of siteDirs) {
    const dbPath = path.join(SITES_DIR, dir, `${dir}.db`);
    const client = createPrismaClient(`file:${dbPath.replace(/\\/g, '/')}`);
    try {
      const referenced = await collectSitePaths(client);
      const siteUploads = path.join(SITES_DIR, dir, 'uploads');
      mkdirSync(siteUploads, { recursive: true });

      let copied = 0;
      let alreadyThere = 0;
      let missingSource = 0;
      for (const relative of referenced) {
        const source = path.join(MAIN_UPLOADS, path.basename(relative));
        const target = path.join(siteUploads, path.basename(relative));
        if (existsSync(target)) {
          alreadyThere += 1;
          continue;
        }
        if (!existsSync(source)) {
          missingSource += 1;
          console.log(`  ! ${dir}: منبع یافت نشد — ${relative}`);
          continue;
        }
        copyFileSync(source, target);
        copied += 1;
      }
      console.log(
        `✅ ${dir}: ${referenced.size} مسیر referenced — کپی ${copied}، از قبل هست ${alreadyThere}، منبع غایب ${missingSource}`
      );
    } finally {
      await client.$disconnect();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
