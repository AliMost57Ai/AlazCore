-- مایگریشن 0002_ticketing-process.sql — تولیدشده با scripts/new-site-migration.ts و
-- بازبینی دستی برای حفظ داده (2026-10-17): بازسازی جدول SupportTicket با
-- displayId بک‌فیل‌شده، نگاشت pending→open و استخراج lastMessage*/readAt از
-- وضعیت قدیمی. اجرا: هر دیتابیس سایت یک بار (ledger _SiteMigration)؛ تراکنشی.
--
-- DROP TABLE پایین بخشی از الگوی استاندارد بازسازی SQLite است: اول همه ردیف‌ها
-- به new_SupportTicket کپی می‌شوند، بعد جدول قدیمی افتاد می‌شود. displayId با
-- ROW_NUMBER در خود INSERT ساخته می‌شود (ستون NOT NULL است و بعداً بک‌فیل
-- نمی‌پذیرد) — ترتیبی و قطعی از createdAt.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
-- بقایای یک اجرای نیمه‌کاره (خطای وسط مایگریشن) پاک می‌شود؛ داده‌ای داخلش نیست.
DROP TABLE IF EXISTS "new_SupportTicket";
CREATE TABLE "new_SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "guestPhone" TEXT,
    "guestToken" TEXT,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAuthor" TEXT NOT NULL DEFAULT 'customer',
    "customerReadAt" DATETIME,
    "staffReadAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- حفظ کامل ردیف‌ها؛ نگاشت واژه‌نامه در خود SELECT:
--   pending (نسخه ۴ وضعیته) → open؛ lastMessageAuthor از وضعیت قدیمی استخراج
--   می‌شود (answered یعنی پشتیبان آخرین پیام را نوشته)؛ lastMessageAt قدیمی‌ها
--   = createdAt (آخرین پیام همان اولین پیام) و درخواست‌کننده تیکت خودش را
--   خوانده است؛ staffReadAt فقط برای answered ست می‌شود تا openهای قدیمی در
--   زنگ‌اخبار «در انتظار پشتیبان» درست دیده شوند.
INSERT INTO "new_SupportTicket" ("id", "displayId", "userId", "subject", "status", "lastMessageAt", "lastMessageAuthor", "customerReadAt", "staffReadAt", "createdAt", "updatedAt")
WITH numbered AS (
    SELECT
        "id",
        "userId",
        "subject",
        "status",
        "createdAt",
        "updatedAt",
        ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn
    FROM "SupportTicket"
)
SELECT
    "id",
    'TK-' || printf('%05d', 90000 + CAST("rn" AS INTEGER)),
    "userId",
    "subject",
    CASE "status" WHEN 'pending' THEN 'open' ELSE "status" END,
    "createdAt",
    CASE "status" WHEN 'answered' THEN 'owner' ELSE 'customer' END,
    "createdAt",
    CASE WHEN "status" = 'answered' THEN "createdAt" ELSE NULL END,
    "createdAt",
    "updatedAt"
FROM "numbered";
DROP TABLE "SupportTicket";
ALTER TABLE "new_SupportTicket" RENAME TO "SupportTicket";
CREATE UNIQUE INDEX "SupportTicket_displayId_key" ON "SupportTicket"("displayId");
CREATE UNIQUE INDEX "SupportTicket_guestToken_key" ON "SupportTicket"("guestToken");
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");
CREATE INDEX "SupportTicket_lastMessageAt_idx" ON "SupportTicket"("lastMessageAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
