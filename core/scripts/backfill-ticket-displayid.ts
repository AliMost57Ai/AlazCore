/**
 * Backfill یک‌بارهٔ core.db قدیمی — ستون اجباری «Ticket.displayId» که راند
 * تیکتینگ اضافه شد. prisma db push افزودن ستون required را روی جدول دارای
 * ردیف رد می‌کند (ردیف‌های قدیمی null می‌ماندند)؛ پس entrypoint کور این
 * اسکریپت را «قبل از» push صدا می‌زند: ستون را با مقدار یکتای TK-##### می‌سازد
 * تا push فقط نرمال‌سازی کند. Idempotent — روی دیتابیس تازه/به‌روز کاری ندارد.
 *
 * اجرا: npx tsx scripts/backfill-ticket-displayid.ts   (از ریشهٔ اپ Core)
 * مسیر دیتابیس: data/${DB_FILE:-core.db} — برای تست با DB_PATH override می‌شود.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPrismaClient } from '../lib/prisma-adapter';

const DB_PATH =
  process.env.DB_PATH ?? path.join(process.cwd(), 'data', process.env.DB_FILE ?? 'core.db');

/** 'TK-' + ۵ رقم یکتا — هم‌قالب تولیدر خود تیکتینگ (lib/core-tickets). */
function randomTicketId(): string {
  return `TK-${String(10_000 + Math.floor(Math.random() * 90_000))}`;
}

async function main(): Promise<void> {
  if (!existsSync(DB_PATH)) {
    console.log(`>>> backfill skipped — no database at ${DB_PATH} (fresh volume; push creates it)`);
    return;
  }

  const prisma = createPrismaClient(`file:${DB_PATH.replace(/\\/g, '/')}`);

  try {
    const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Ticket'"
    );
    if (tables.length === 0) {
      console.log('>>> backfill skipped — no Ticket table yet (fresh schema).');
      return;
    }

    const columns = await prisma.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM pragma_table_info('Ticket')"
    );
    if (columns.some((column) => column.name === 'displayId')) {
      console.log('>>> backfill skipped — Ticket.displayId already exists.');
      return;
    }

    // ستون با NOT NULL DEFAULT '' می‌سازیم (SQLite اجازهٔ NOT NULL بدون default
    // در ADD COLUMN نمی‌دهد)، ردیف‌های موجود را با شناسهٔ یکتا پر می‌کنیم و
    // ایندکس یونیکِ schema را خودمان می‌سازیم تا push فقط همان را ببیند.
    await prisma.$executeRawUnsafe(`ALTER TABLE "Ticket" ADD COLUMN "displayId" TEXT NOT NULL DEFAULT ''`);

    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      "SELECT id FROM \"Ticket\" WHERE \"displayId\" = ''"
    );
    const taken = new Set(
      (
        await prisma.$queryRawUnsafe<{ displayId: string }[]>(
          'SELECT "displayId" FROM "Ticket" WHERE "displayId" != \'\''
        )
      ).map((row) => row.displayId)
    );
    for (const row of rows) {
      let candidate = randomTicketId();
      while (taken.has(candidate)) {
        candidate = randomTicketId();
      }
      taken.add(candidate);
      await prisma.$executeRawUnsafe('UPDATE "Ticket" SET "displayId" = ? WHERE id = ?', candidate, row.id);
    }

    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_displayId_key" ON "Ticket"("displayId")'
    );

    console.log(`>>> backfill done — ${rows.length} legacy ticket row(s) got a unique displayId.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
