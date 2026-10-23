# Task: dockerize — داکرایز شدن فروشگاه و پنل Core با دو image مستقل

## وضعیت پایپ‌لاین

| مرحله | وضعیت |
| --- | --- |
| solution-architect | ✅ انجام شد (سند پایین) |
| پیاده‌سازی (docker/* + compose + docs) | ✅ انجام شد |
| تست اجرا (build + smoke test) | ✅ سبز — جزئیات پایین |
| tech-lead | ✅ تایید نهایی (پایین) |

## گزارش تست (qa — اجرای واقعی روی Docker Desktop ویندوز)

- بیلد هر دو image: `alazcore-shop:1.0.0` و `alazcore-core:1.0.0` — موفق.
- `docker compose up -d` با volume خالی: هر دو سرویس healthy؛ `db push` خودکار +
  seed خودکار (فقط بوت اول)؛ `/login` هر دو اپ = 200.
- لاگین ادمین فروشگاه (admin@mantine.dev) و ادمین Core (admin@alazcore.ir) موفق.
- **E2E پروویژن cross-container**: ثبت دامنه `testdocker.ir` از پنل Core → پاسخ
  `dbStatus:"ready"`؛ فایل `testdocker.ir.db` از داخل کانتینر فروشگاه روی volume
  مشترک قابل مشاهده؛ `POST /api/validate` با کلید درست `ok:true` (و با کلید غلط 401).
- **گیت لایسنس E2E**: درخواست فروشگاه با Host دامنه‌ی ثبت‌شده → فروشگاه از
  `http://core:3100` استعلام کرد، وضعیت `inactive` (دامنه بی‌پلن) → ریدایرکت به
  `/site-inactive` — زنجیره fail-closed سالم.
- ری‌استارت: `db push` دوم بی‌اثر («already in sync») و seed دوباره اجرا نشد (دیتا ماند).
- TZ داخل container = +0330 ✓
- داخل image نهایی هیچ `/app/data` و `.env` وجود ندارد؛ `prisma/site-schema.sql`
  در هر دو image سر جای مورد انتظار است.

## نکات فنی که در بیلد یاد گرفته شد (برای تکرار‌نشدن)

1. `ENV NODE_ENV=production` باعث می‌شود `npm ci` فقط وابستگی‌های prod را نصب کند
   و `next build` با «Cannot find module postcss-preset-mantine» بشکند →
   `npm ci --include=dev` صریح لازم است.
2. postinstall (`prisma generate`) بدون schema کار نمی‌کند → schema باید قبل از
   `npm ci` کپی شود.
3. node:22-bookworm-slim باینری openssl ندارد؛ Prisma نمی‌تواند engine درست را
   تشخیص دهد → `apt-get install openssl` پیش از npm ci.
4. `npm install --no-save prisma tsx` در حالت production نصب نمی‌کند («up to date»
   دروغ می‌گوید) → این دو ابزار global نصب شدند (`npm install --global`).
5. Git Bash در ویندوز مسیرهای `/app/...` در آرگومان‌های docker exec را به مسیر
   ویندوزی تبدیل می‌کند → دستور را داخل `sh -c '...'` بگذارید.
6. شبکه‌ی npm ناپایدار → NPM_CONFIG_FETCH_RETRIES=5 و timeout های بلند در ENV.

## تایید tech-lead

- هیچ تغییری در کد اپ‌ها و package.json داده نشد — فیچر صرفاً زیرساختی است؛
  سطح ریسک حداقلی.
- سکرت‌ها داخل image بیک نمی‌شوند (راستی‌آزمایی شد)؛ فقط از docker.env در زمان اجرا.
- پورت‌های expose همان 3000/3100 مستندات قبلی است؛ healthcheck روی /login عمومی.
- حجم imageها (3.06GB / 2.34GB) قابل قبول برای استقرار novice؛ بهینه‌سازی با
  `output: standalone` به‌عنوان کار آینده (خارج از محدوده این تسک).
- npm audit یک بار «8 vulnerabilities (2 moderate, 5 high, 1 critical)» روی درخت
  وابستگی‌های prod گزارش کرد — پیش‌موجود و بی‌ربط به این فیچر؛ پیگیری جدا پیشنهاد می‌شود.
- status: **APPROVED** — فیچر آماده گزارش به کاربر.

## دور ۲ — تغییر volume به bind mount ویندوزی (2026-10-07، درخواست کاربر)

کاربر کانتینر را از دکمه‌ی Run داکر دسکتاپ اجرا کرده بود: بدون env (لاگین
«خطای شبکه» با `CORE_AUTH_SECRET is missing` در لاگ) و mount پوشه‌ی ویندوزی‌اش
روی مسیر اشتباه `/volumes/AlazCoreVol` به‌جای `/app/data`. تغییرات:

1. compose از named volume به **bind mount ویندوزی** تغییر کرد:
   `${DOCKER_DATA_DIR:-D:/AliMost/NextTest/Github/DockerVolume}` →
   `Shop`:/app/data فروشگاه و `Core`:/app/data (+`Shop`:/shop/data در کور) —
   دیتابیس و uploads الان قابل مشاهده در Explorer هستند (تست شد: core.db و
   app.db واقعاً در همان مسیرها ساخته می‌شوند؛ دیتابیس سایت پروویژن‌شده هم
   در Shop\sites\ دیده شد).
2. تذکر «فقط با docker compose up اجرا کنید، نه دکمه Run» به DOCKER.md (بخش ۰
   + دو ردیف جدید در اشتباه‌های رایج) اضافه شد؛ بکاپ/انتقال دیتا برای bind
   mount ساده‌سازی شد؛ هشدار `down -v` اصلاح شد (با bind mount دیتا پاک نمی‌شود).
3. کانتینر شکسته‌ی Core1 و volume بلااستفاده‌ی AlazCoreVol حذف شد؛ تست دور ۲
   (لاگین کور + پروویژن + حذف دامنه تستی) سبز.


## سند راه‌حل (solution-architect)

### مسئله
کاربر می‌خواهد کل پروژه (اپ فروشگاه در ریشه + اپ مستقل Core در `core/`) داکرایز شود:
دو image جداگانه، دیتابیس‌ها و uploads در volume خارجی (خارج از container)،
و راهنمای کامل راه‌اندازی برای کسی که Docker بلد نیست.

### پشته فنی
- فقط پشته **Node.js/Next.js** — اپ فروشگاه (ریشه، Next 16.3.5) و اپ Core (`core/`، Next 16.3.5).
- دیتابیس: **SQLite** (بدون سرور دیتابیس) — `data/app.db` (فروشگاه، هاردکد `file:../data/app.db`
  نسبت به `prisma/`)، `core/data/core.db` (هاردکد `file:../data/core.db`)، و دیتابیس‌های
  multi-tenant سایت‌ها در `data/sites/{dir}/{dir}.db`.
- هیچ تغییری در کد اپ‌ها لازم نیست — همه مسیرهای زمان اجرا `process.cwd()`-محورند
  (`lib/site-db.ts`, `lib/upload-image.ts`, `core/lib/provision.ts`, `core/lib/catalog-assets.ts`).

### تصمیم‌های کلیدی معماری
1. **بدون `output: standalone`** — image با `next start` اجرا می‌شود و node_modules کامل
   (پس از prune وابستگی‌های dev + بازگرداندن prisma CLI و tsx برای entrypoint) دارد.
   دلیل: سادگی و اطمینان (Prisma engine، sharp و مسیرهای cwd-محور بدون دست‌کاری).
2. **entrypoint هر دو image**: `mkdir -p data` → `prisma db push --skip-generate`
   (idempotent؛ schema جدید با هر استارت اعمال می‌شود) → seed فقط وقتی فایل دیتابیس
   وجود نداشت (بوت اول روی volume خالی — حساب ادمین بدون seed وجود ندارد) → `next start`.
3. **Volumeهای named خارجی**:
   - `shop_data` → فروشگاه `/app/data` (شامل `app.db`، `sites/`، `uploads/`)
   - `core_data` → Core `/app/data` (شامل `core.db` و آپلودهای پنل)
4. **اتصال provision (تنها وابستگی فایل بین دو اپ)**: پنل Core هنگام ثبت دامنه، دیتابیس
   سایت را مستقیم در دیتای فروشگاه می‌سازد و `prisma/site-schema.sql` فروشگاه را می‌خواند.
   راه‌حل: volume `shop_data` علاوه بر فروشگاه، در کانتینر Core هم روی `/shop/data` mount
   می‌شود و فایل `prisma/site-schema.sql` فروشگاه در بیلد داخل image کور کپی می‌شود به
   `/shop/prisma/site-schema.sql`؛ متغیر `SHOP_APP_ROOT=/shop`.
5. **شبکه**: compose داخلی — فروشگاه `CORE_API_URL=http://core:3100`،
   Core `SHOP_API_URL=http://shop:3000` (قاعده API-only؛ Core دیتابیس فروشگاه را
   جز پروویژن باز نمی‌کند).
6. **پورت‌ها**: فروشگاه 3000، Core 3100 — همان پورت‌های متعارف پروژه؛ روی هاست همان‌ها map می‌شوند.
7. **سلامت**: healthcheck با fetch داخلی node (بدون نصب curl)، `restart: unless-stopped`.
8. **TZ**: `TZ=Asia/Tehran` از طریق env (قابل تغییر) — رفتار ساعت مطابق سیستم توسعه.
9. **TZ/سکرت‌ها**: هیچ سکرتی داخل image بیلد نمی‌شود (`.dockerignore` جلوی `.env*` را می‌گیرد)؛
   همه از `docker.env` (env_file در compose) می‌آیند. `docker.env` به `.gitignore` اضافه می‌شود.

### مدل‌ها و جداول تحت تاثیر
هیچ — تغییر دیتابیسی وجود ندارد.

### لایه‌های درگیر
فقط زیرساخت: `docker/Dockerfile.shop`، `docker/Dockerfile.core`، `docker/entrypoint.sh`،
`docker-compose.yml`، `.dockerignore`، `docker.env.example`، `DOCKER.md`.
db-architect/backend/frontend/ui بی‌اثر (بدون تغییر کد اپ).

### Edge Caseها
1. **بوت اول روی volume خالی** → db push فایل را می‌سازد؛ seed اجرا می‌شود تا حساب ادمین
   وجود داشته باشد (seed فقط وقتی فایل دیتابیس از قبل نبود؛ دیتای موجود هرگز seed نمی‌شود).
2. **provision دامنه توسط Core قبل از اولین استارت فروشگاه** → volume مشترک + site-schema.sql
   داخل image کور؛ فروشگاه هنگام اتصال فقط bootstrap می‌کند (رفتار موجود `ensureSiteDb`).
3. **schema destructive در آینده** → `prisma db push` غیرتعاملی با خطا متوقف می‌شود
   (container بالا نمی‌آید) — باید آگاهانه با `--accept-data-loss` دستی انجام شود؛ در مستند آمده.
4. **پورت 3000/3100 اشغال روی هاست** (سرور dev خود کاربر) → در مستند: تغییر سمت هاست mapping.
5. **عوض شدن AUTH_SECRET/CORE_AUTH_SECRET** → همه نشست‌ها بی‌اعتبار (رفتار عمدی؛ مستند شده).

### ریسک‌ها
- **حجم image**: با prune devDependencies ~نصف می‌شود؛ prisma CLI و tsx برای entrypoint
  نگه داشته می‌شوند (`npm install --no-save` داخل بیلد).
- **CRLF ویندوز**: `docker/entrypoint.sh` باید LF باشد — بعد از نوشتن چک می‌شود.
- **قفل فایل SQLite بین دو کانتینر** (provision همزمان): هر دو روی volume محلیِ همان هاست
  هستند (WSL2/لینوکس) — فایل‌لاک معتبر است؛ contention فقط در لحظه ثبت دامنه.
- security-reviewer: هیچ پورت اضافه‌ای expose نمی‌شود؛ Core فقط از طریق پورت map شده در دسترس
  است؛ سکرت‌ها فقط runtime.

### معیار پذیرش (Acceptance Criteria)
1. `docker compose build` دو image مستقل `alazcore-shop` و `alazcore-core` می‌سازد.
2. `docker compose up -d` با volumeهای خالی، هر دو اپ را سالم بالا می‌آورد؛
   `/login` هر دو 200 می‌دهد و healthcheckها healthy می‌شوند.
3. دیتابیس‌ها و uploads فقط داخل volumeهای named هستند — داخل image هیچ `*.db` یا
   دیتای کاربر وجود ندارد (`docker exec ... ls`).
4. نوشتن از سمت Core در `/shop/data` از سمت فروشگاه در `/app/data` دیده می‌شود (volume مشترک).
5. `docker save` هر دو image در `D:\AliMost\NextTest\Github` فایل tar می‌سازد که با
   `docker load` قابل بازگرداندن است.
6. `DOCKER.md` مسیر کامل راه‌اندازی از صفر (نصب Docker تا SSL) را پوشش می‌دهد.

### نیاز به تایید کاربر
- گیت: ساخت برنچ/کامیت طبق skill git-workflow بعد از تایید کاربر انجام می‌شود.
