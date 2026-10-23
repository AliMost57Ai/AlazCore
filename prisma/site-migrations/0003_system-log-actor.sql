-- مایگریشن 0003_system-log-actor.sql — تولیدشده با scripts/new-site-migration.ts (2026-10-17T11:45:25.560Z).
-- اجرا: هر دیتابیس سایت یک بار (ledger _SiteMigration)؛ تراکنشی و idempotent.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SystemLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "actorName" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SystemLog" ("action", "createdAt", "detail", "id", "kind", "message", "provider") SELECT "action", "createdAt", "detail", "id", "kind", "message", "provider" FROM "SystemLog";
DROP TABLE "SystemLog";
ALTER TABLE "new_SystemLog" RENAME TO "SystemLog";
CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");
CREATE INDEX "SystemLog_kind_createdAt_idx" ON "SystemLog"("kind", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
