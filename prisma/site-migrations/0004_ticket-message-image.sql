-- مایگریشن 0004_ticket-message-image.sql — تولیدشده با scripts/new-site-migration.ts (2026-10-17T12:09:51.266Z).
-- اجرا: هر دیتابیس سایت یک بار (ledger _SiteMigration)؛ تراکنشی و idempotent.
-- AlterTable
ALTER TABLE "SupportTicketMessage" ADD COLUMN "imagePath" TEXT;
