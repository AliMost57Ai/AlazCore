#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Entrypoint مشترک فروشگاه و پنل Core در Docker.
# ترتیب کار در هر استارت:
#   ۱) چک خالی‌بودن volume (قبل از db push — چون push خودش فایل دیتابیس را می‌سازد)
#   ۲) `prisma db push` — idempotent: با schema تغییریافته، تغییرات را اعمال
#      می‌کند؛ با schema بدون تغییر، عملاً هیچ کاری نمی‌کند (چند ثانیه).
#   ۳) بوت اول روی volume خالی → seed دمو (شامل حساب ادمین — بدون آن ورود ممکن نیست).
#   ۴) فقط فروشگاه (DB_FILE=app.db): مایگریشن داده‌محفوظ همه‌ی دیتابیس‌های
#      سایت‌ها (data/sites/*/*.db) — با هر پابلیش، همه‌ی سایت‌ها بدون از دست
#      رفتن داده به‌روز می‌شوند (scripts/migrate-sites.ts).
#   ۵) اجرای Next.js روی پورت PORT.
# ترتیب shutdown هم درست است: exec باعث می‌شود سیگنال stop داکر مستقیم به
# process نود برسد (PID 1 = next).
# ─────────────────────────────────────────────────────────────────────────────
set -e

DB_FILE="${DB_FILE:-app.db}"
mkdir -p data

# backfill قبل از push — فقط اپ Core: تیکتینگ ستون اجباری «Ticket.displayId» را
# آورد و db push روی core.dbِ دارای تیکتِ قدیمی رد می‌شود (ردیف بدون مقدار).
# این اسکریپت ستون را با شناسهٔ یکتا می‌سازد تا push فقط نرمال‌سازی کند؛ روی
# دیتابیس تازه/به‌روز عملاً هیچ‌کار نمی‌کند (idempotent).
if [ "${DB_FILE}" != "app.db" ] && [ -f "scripts/backfill-ticket-displayid.ts" ]; then
  echo ">>> Backfilling core ticket displayId (legacy rows)..."
  npx tsx scripts/backfill-ticket-displayid.ts
fi

FRESH_DB=0
if [ ! -f "data/${DB_FILE}" ]; then
  FRESH_DB=1
fi

echo ">>> Syncing database schema (prisma db push)..."
# Prisma 7: فلگ --skip-generate حذف شده است — generate از db push جدا شده.
npx prisma db push

if [ "${FRESH_DB}" = "1" ] && [ "${SEED_ON_FIRST_BOOT:-true}" = "true" ]; then
  echo ">>> Fresh database detected — seeding demo data (admin account included)..."
  npx tsx prisma/seed.ts
fi

# مایگریشن دیتابیس‌های per-domain فقط مال اپ فروشگاه است (کور این اسکریپت را
# در image خود ندارد و دیتابیس اصلی کور با db push بالا به‌روز می‌شود).
if [ "${DB_FILE}" = "app.db" ] && [ -f "scripts/migrate-sites.ts" ]; then
  echo ">>> Applying pending site migrations (data/sites/*)..."
  npx tsx scripts/migrate-sites.ts
fi

# فایل‌های آپلودیِ جابه‌جاشدهٔ دورِ قبل از فیکس کانتکست — برای هر سایت، مسیرهای
# referenced از جدول‌هایش جمع و از data/uploads به دیر سایتش کپی می‌شود
# (idempotent؛ بدون آن تصاویر موجود بعد از فیکس /api/files هدر می‌رفتند).
if [ "${DB_FILE}" = "app.db" ] && [ -f "scripts/migrate-site-uploads.ts" ]; then
  echo ">>> Migrating misplaced site uploads (data/sites/*/uploads)..."
  npx tsx scripts/migrate-site-uploads.ts
fi

# بررسی ماژول بومی SQLite پیش از استارت — اگر image با Node دیگری بیلد شده باشد،
# اینجا پیام روشن (نسخه‌ی Node/ABI + راه‌حل) در لاگ می‌آید نه خطای مبهم Prisma.
if [ -f scripts/check-native.cjs ]; then
  node scripts/check-native.cjs
fi

exec npx next start -p "${PORT:-3000}"
