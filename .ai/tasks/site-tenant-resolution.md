# Task: site-tenant-resolution — گیت اجباری کور + tenant دیتابیس + مایگریشن سایت‌ها + جداسازی env

## پشته فنی

- Node.js/Next.js (فروشگاه در ریشه + اپ مستقل `core/`)، SQLite، Mantine UI.
- بدون تغییر schema دامنه/پلن؛ جدول سیستمی `_SiteMigration` داخل دیتابیس هر سایت.

## مسئله (گزارش کاربر بعد از استقرار Docker روی سرور)

1. همه‌ی درخواست‌ها به یک `data/app.db` می‌روند و دیتابیس‌های دامنه‌ها خالی می‌مانند.
2. env توسعه و production جدا نیست؛ production باید دامنه را از Host بخواند.
3. در production باید وجود/اعتبار دامنه **حتماً از سمت کور** بررسی شود و بعد سایت لود شود.
4. اعتبارنامه ادمین هر دامنه باید بعد از provision در صفحه‌ی تعریف دامنه دیده شود.
5. بعد از هر پابلیش، دیتابیس‌های دامنه بدون از دست رفتن داده به‌روز شوند (مایگریشن اتوماتیک/اسکریپتی).
6. کش لایسنس ۶۰ ثانیه‌ای کم است — حداقل ۱۵ دقیقه.

## ریشه باگ

| # | مسیر | محل |
| --- | --- | --- |
| ۱ | Core تنظیم‌نشده = گیت غیرفعال | `lib/core-license.ts` getLicense |
| ۲ | گیت لایسنس فقط روی صفحات (matcher همه‌ی `/api` را مستثنا می‌کرد) | `proxy.ts` matcher |
| ۳ | fallback بی‌صدا به app.db وقتی فایل دیتابیس دامنه نیست | `lib/db.ts` ensureAndClient |
| ۴ | SHOP_DOMAIN روی همه درخواست‌ها حتی production | site-context/proxy/core-license |
| ۵ | مایگریشن schema فقط «لیست هاردکد» داخل ensureSiteDb — بدون نسخه‌بندی/اسکریپت | `lib/site-db.ts` |
| ۶ | کش inflight سراسری `__siteEnsureInflight` «اولین دامنه را برای همیشه» قفل می‌کرد | `lib/db.ts` |
| ۷ | Next بعد از proxy درخواست را داخلی بازdispatch می‌کند و Host در handlerها localhost می‌شود → resolver داخل handler دامنه‌ی درست نمی‌دید | یافته‌ی تست 2026-10-16 |
| ۸ | enterWith داخل هلپر await‌شده به ادامه‌ی handler برنمی‌گردد (ALS والد را عوض نمی‌کند) | یافته‌ی تست 2026-10-16 |

## راه‌حل پیاده‌شده

- `resolveSiteDomain` مرکزی در `lib/site-runtime.ts`: dev با SHOP_DOMAIN (بی‌توجه به آدرس)؛ prod فقط Host (SHOP_DOMAIN فقط برای درخواست localhost = سرور تست)؛ `host` قبل از `x-forwarded-host` (پشت nginx Host اجباری است، x-forwarded-host فورج‌پذیر).
- proxy: گیت لایسنس + fail-closed دیتابیس روی صفحات **و APIها** (matcher فقط `api/core` را مستثنا می‌کند)؛ دامنه‌ی resolveشده را در `x-site-domain` پاس می‌دهد و **همیشه بازنویسی/حذفش می‌کند** (فورج کلاینت زنده نمی‌ماند — رفع ریشه‌ی ۷).
- API دامنه مسدود/ثبت‌نشده → JSON 503؛ صفحه → redirect `/site-inactive` (دامنه pending → پیام «در حال آماده‌سازی»).
- Core تنظیم‌نشده در production = مثل کور قطع (CORE_FAIL_MODE، پیش‌فرض docker.env.example → closed).
- `lib/db.ts`: حذف کش inflight سراسری (رفع ۶)؛ prod بدون فایل دیتابیس سایت → `SiteUnavailableError` — هرگز app.db.
- مایگریشن داده‌محفوظ: `prisma/site-migrations/NNNN_*.sql` با گاردهای `@if-no-*`، اعمال‌کننده `lib/site-migrations.ts` (ledger `_SiteMigration`، تراکنش در هر فایل)، تولید `npm run db:site-migration -- <نام>` (prisma migrate diff) و اعمال `npm run db:migrate-sites` (entrypoint داکر قبل از next start + fallback داخل ensureSiteDb). لیست هاردکد قبلی → `0001_baseline_light_migrations.sql`.
- provision کور: schema + ledger + **ادمین admin@{دامنه}/admin1234 همان لحظه‌ی ثبت** + rename اتمیک (tmp → نهایی).
- اعتبارنامه: API فروشگاه `/api/core/site-admin` (GET وضعیت/POST reset؛ x-core-key + x-site-domain) ← پروکسی کور `/api/domains/[id]/site-admin` ← کارت «اطلاعات ورود فروشگاه» در صفحه ویرایش دامنه (کپی/بازنشانی/هشدار) + بعد از ایجاد دامنه هدایت به همان صفحه.
- کش لایسنس ۱۵ دقیقه (`LICENSE_CACHE_TTL_SEC`، پیش‌فرض 900).
- env: docker.env.example بدون SHOP_DOMAIN + closed + SEED_ON_FIRST_BOOT=false؛ `.dockerignore` الگوی `**/.env.*`؛ حذف `docker-compose.joghd.yml` (هر دو نسخه).

## وضعیت پایپ‌لاین

| مرحله | وضعیت |
| --- | --- |
| solution-architect | ✅ سند بالا (طرح تأیید کاربر) |
| nodejs-developer (فروشگاه) | ✅ |
| nodejs-developer (مایگریشن + کور) | ✅ |
| nextjs-frontend-developer (کارت اعتبارنامه) | ✅ |
| qa-tester | ✅ سبز — گزارش پایین |
| security-reviewer | ✅ بدون مشکل باز — گزارش پایین |
| tech-lead | ✅ تایید نهایی — گزارش پایین |

## گزارش qa-tester (2026-10-16)

**Unit (jest): 93/93 سبز** — شامل ۱۳ تست جدید: ماتریس resolveSiteDomain (dev/prod × SHOP_DOMAIN/localhost/دامنه) و جریان مایگریشن واقعی روی SQLite موقت (0001 گارددار روی schema تجمعی، مایگریشن جدید بدون حذف داده، idempotency، markAll).

**اجرای `scripts/migrate-sites.ts` روی دیتابیس‌های واقعی dev**: هر سه سایت (joghd.ir/shop2.ir/shopify.com) — 0001 اعمال شد؛ داده‌ها سالم (`check-site-user`: کاربران قبلی سر جایشان).

**بازبینی دستی prod شبیه‌سازی‌شده** (`next start -p 3005` + کور 3100 + `.env` محلی):
- localhost + SHOP_DOMAIN=shop2.ir → ورود `admin@shop2.ir`/admin1234 = 200 ✓ (معیار ۱)
- Host: joghd.ir → ورود `admin@joghd.ir` = 200؛ ورود `admin@shop2.ir` روی همان Host = 401 ✓ (ایزولاسیون tenant)
- فورج هدر `x-site-domain: shop2.ir` روی Host=joghd.ir → 401 (بی‌اثر) ✓
- Host: unregistered.ir → صفحه 307 به /site-inactive؛ API همان دامنه = 503 JSON ✓ (معیار ۲)
- کور قطع (3100 پایین) + CORE_FAIL_MODE=closed → همه‌ی مسیرها /site-inactive ✓
- reports هر دامنه داده‌ی متفاوت خودش را برمی‌گرداند (shop2: ۵ کالای shop2؛ joghd: ۵ ردیف joghd) ✓
- E2E اعتبارنامه: ثبت دامنه `test-provision.ir` از پنل کور → 201 + `dbStatus:ready` + فایل DB + ردیف `admin@test-provision.ir` بلافاصله ساخته شد ✓ (معیار ۵)؛ GET/POST `/api/domains/{id}/site-admin` از پنل کور (پروکسی → فروشگاه) = 200؛ کارت در صفحه ویرایش رندر شد. دامنه و فایل تست پاک شدند.
- بیلد هر دو اپ سبز؛ jest/typecheck/prettier سبز.

**نکات گیت**: `npm run lint` روی فایل‌های این تسک ۰ خطا دارد؛ ۴۹ خطای eslint باقی‌مانده‌ی پروژه **از قبل روی برنچ پایه موجود است** (PersianDateTimePicker/returns/coupons/… — با `git show HEAD` تأیید شد) و خارج از محدوده‌ی این تسک است.

**باگ‌های کشف‌شده در تست و رفع‌شده**: (۷) بازdispatch داخلی Next و Host=localhost در handlerها → پاس دادن دامنه با هدر بازنویسی‌شده؛ (۸) enterWith در هلپر → الگوی «resolve در هلپر، enterSiteContext در فریم handler» + `ensureCoreSiteDb`.

## گزارش security-reviewer (بدون مشکل باز)

1. **حذف x-site-domain از resolve عمومی**: هدر کلاینتی حالا فقط دو مسیر معتبر دارد — بازنویسی‌شده توسط proxy (فورج بازنویسی/حذف می‌شود) یا `ensureCoreSiteDb` بعد از احراز timing-safe کلید x-core-key. تست فورج عملی: 401.
2. **Host قبل از x-forwarded-host** در resolver (پشت nginx مقدار Host اجباری است؛ X-Forwarded-Host کلاینتی بدون بازنویسی توسط nginx پاس نمی‌شود). مستند شد که nginx باید `proxy_set_header Host $host;` داشته باشد و پورت‌ها loopback بمانند.
3. **گیت روی APIها**: دامنه مسدود → 503؛ payment callback همزمان با تعلیق ناموفق می‌شود — قرارداد fail-closed (به کاربر اعلام شد).
4. **routeهای جدید**: `x-core-key` با timingSafeEqual (کپی الگوی موجود)؛ پروکسی کور پشت `requireApiMenu('/panel/domains', 'edit')` (reset) / view (GET)؛ رمز در API برنمی‌گردد — فقط `isDefaultPassword`.
5. **provision**: SQL پارامتری، id از randomUUID، sanitize مسیر مثل قبل؛ rename اتمیک مانع دیدن فایل نیمه‌ساخته.
6. **fallback حذف‌شده به app.db** = بستن نشتی داده‌ی بین سایت‌ها (قبلاً دیتای یک سایت از URL سایت دیگر سرو می‌شد).

## تایید tech-lead

- پیاده‌سازی مطابق سند مصوب؛ همه‌ی معیارهای پذیرش ۱-۶ پوشش و تست شدند.
- routeها لاغرند (authorize/bind helpers)، منطق در lib، بدون any غیرضروری، بدون وابستگی جدید.
- الگوی ALS (globalThis singleton + enterWith فقط در فریم درخواست) مستند شد در site-context/site-runtime.
- `docker-compose.joghd.yml` حذف شد (تصمیم بازِ طرح با پیشنهاد حذف — کاربر در مرور طرح اعمال کرد؛ چند‌دامنه روی یک container با هدر Host جایگزین شد و DOCKER.md §13 بازنویسی شد).
- آپدیت مستندات: DOCKER.md (§۵/§۹/§۱۳)، DEPLOY-CORE.md (§۳/§۷)، .env.exampleها، Dockerfile.core (کپی site-migrations).

## نکته استقرار روی سرور (خارج از کد)

- `docker.env` سرور: `SHOP_DOMAIN` حذف شود؛ nginx باید `proxy_set_header Host $host;` بگذارد؛ `CORE_FAIL_MODE=closed` پیشنهاد.
- داده‌ی افتاده در app.db سرور (اگر رکورد واقعی دارد) باید دستی منتقل/دوباره ثبت شود — باگ fallback سابق.
- بعد از هر پابلیش، entrypoint خودش مایگریشن همه‌ی دیتابیس‌ها را اعمال می‌کند (دستی: `docker compose exec shop npx tsx scripts/migrate-sites.ts`).
