# پنل Core (SuperAdmin) — راهنمای راه‌اندازی و استقرار

پنل Core سامانه مرکزی مدیریت فروشگاه‌ساز AlazCore است: مدیریت دامین‌های
فروشگاه‌های متصل، پلن‌ها، تم‌ها، تیکت پشتیبانی، کاربران پنل و تخصیص
درگاه‌ها/پنل‌های پیامکی به هر دامنه. این اپ **کاملاً مستقل** از فروشگاه است —
کد، دیتابیس، نشست و پورت جدا — و می‌تواند روی سرور دیگری deploy شود.

---

## ۰) ورود به پنل (توسعه محلی)

```bash
cd core
npm install        # postinstall خودش prisma generate را می‌زند
npm run db:push    # ساخت core/data/core.db از روی schema
npm run db:seed    # حساب‌ها + تم‌های پایه + پلن نمونه + دامین دمو
npm run dev        # پورت ۳۱۰۰
```

سپس در مرورگر:

| مورد | مقدار |
| --- | --- |
| آدرس پنل | `http://localhost:3100` (به `/panel` هدایت می‌شود) |
| ورود | `http://localhost:3100/login` |
| مدیر کل | `admin@alazcore.ir` / `admin1234` |
| پشتیبان (فقط تیکت/مشاهده) | `support@alazcore.ir` / `support1234` |

صفحات پنل: داشبورد، `/panel/domains` (مدیریت دامین‌ها + تخصیص درگاه/پیامک)،
`/panel/plans`، `/panel/templates`، `/panel/tickets`، `/panel/users`،
`/panel/settings` (کلید API اعتبارسنجی).

## ۱) متغیرهای محیطی

`core/.env.example` را به `core/.env` کپی کنید:

| متغیر | توضیح |
| --- | --- |
| `CORE_AUTH_SECRET` | کلید امضای کوکی نشست پنل (اجباری در پروداکشن، ≥۱۶ نویسه) |
| `CORE_API_KEY` | کلید API سرویس `/api/validate` — اگر خالی باشد از `CoreSetting.api_key` (صفحه تنظیمات) خوانده می‌شود |

## ۲) API اعتبارسنجی لایسنس (بند ۲-۹)

هر فروشگاه پیش از لود شدن، خودش را با این سرویس چک می‌کند:

```bash
curl -X POST http://<core-host>:3100/api/validate \
  -H "x-core-key: <CORE_API_KEY>" -H "Content-Type: application/json" \
  -d '{"domain":"joghd.ir"}'
```

پاسخ شامل `status` (active/inactive/suspended/expired/unknown)، پلن و
منوهای مجاز آن، تم فعال، و درگاه‌ها/پنل‌های پیامکی فعالِ آن دامنه است.
کلید اشتباه = `401`؛ دامنه ثبت‌نشده = بدنه `ok:false` با `status:"unknown"`.

## ۳) اتصال فروشگاه به Core

در `.env` فروشگاه:

```env
CORE_API_URL=http://<core-host>:3100
CORE_API_KEY=<همان کلید>
# SHOP_DOMAIN فقط برای توسعه/تست محلی (دامنه از آن خوانده می‌شود، نه هدر)؛
# در production حتماً کامنت باشد — دامنه همیشه از هدر Host می‌آید.
# SHOP_DOMAIN=shop140.ir
CORE_FAIL_MODE=closed       # production: بدون تأیید Core هیچ سایتی لود نمی‌شود
                            # dev/test: open = اگر Core در دسترس نبود باز بماند
LICENSE_CACHE_TTL_SEC=900   # اختیاری — پیش‌فرض ۱۵ دقیقه (کش per-domain)
```

`CORE_FAIL_MODE` فقط حالت «Core در دسترس نیست» (قطع/401/پیکربندی‌نشده) را
تعیین می‌کند؛ پاسخ معتبر ولی منفیِ Core (دامنه‌ی `inactive/suspended/expired/
unknown`) در هر دو حالت سایت را مسدود می‌کند — این عمدی است.

اثر اتصال (فروشگاه):
- اعتبارسنجی دامنه در production اجباری است — دامنه غیرفعال/معلق/منقضی/
  ثبت‌نشده (و حتی کورِ پیکربندی‌نشده با CORE_FAIL_MODE=closed) → به
  `/site-inactive` می‌رود؛ APIهای همان دامنه هم 503 می‌گیرند.
- منوهای پنل ادمین = اشتراک نقش داخلی و منوهای پلن Core؛ تنظیمات
  درگاه/اقساط/پیامک فقط وقتی می‌مانند که Core برای آن دامنه فعال کرده باشد.
- بدون این متغیرها در **production** فروشگاه مسدود است (همان قرارداد
  fail-closed؛ پیام `license:down`) — فقط محیط توسعه‌ی بدون Core مستقل و باز
  کار می‌کند. برای اجرای مستقل، Core را بالا بیاور یا عمداً
  `CORE_FAIL_MODE=open` بگذار (فقط در توسعه).

کش لایسنس ۱۵ دقیقه (۹۰۰ ثانیه) و **به‌ازای هر دامنه** در حافظه است؛ تغییر
وضعیت هر دامنه در Core حداکثر ۱۵ دقیقه بعد فقط روی همان دامنه اعمال می‌شود
(دامنه‌های دیگر کش و دیتابیس خودشان را دارند).

## ۴) استقرار مستقل روی سرور (VPS)

```bash
sudo mkdir -p /var/www/alazcore-core && sudo chown $USER /var/www/alazcore-core
git clone <repo> /var/www/alazcore-core && cd /var/www/alazcore-core/core
npm ci
cp .env.example .env   # CORE_AUTH_SECRET را پر کنید (openssl rand -base64 32)
npm run db:push && npm run db:seed
npm run build
pm2 start npm --name alazcore-core -- start   # پورت ۳۱۰۰
```

nginx جدا (دامنه یا زیردامنه اختصاصی، مثل `core.example.com`) با همان قالب
DEPLOY.md و `proxy_pass http://127.0.0.1:3100;`. SSL با certbot.

پشتیبان‌گیری: فقط `core/data/core.db`:

```bash
sqlite3 /var/www/alazcore-core/core/data/core.db "VACUUM INTO '/backup/core-$(date +%F).db'"
```

## ۵) چک‌لیست پس از استقرار

- [ ] `http://<core-host>:3100` صفحه ورود را نشان می‌دهد
- [ ] ورود مدیر کل کار می‌کند و رمز عوض می‌شود
- [ ] دامنه فروشگاه (مثل joghd.ir) ثبت و فعال شده و پلن/تم/درگاه گرفته است
- [ ] `curl -X POST .../api/validate` با کلید درست `ok:true` می‌دهد
- [ ] `.env` فروشگاه پر شده و بعد از ری‌استارت، صفحه اصلی سایت بالا می‌آید
- [ ] غیرفعال‌کردن دامنه در Core → حداکثر ۱۵ دقیقه بعد همان سایت روی `/site-inactive` می‌رود

## ۵-۱) عیب‌یابی «سایت مسدود است» (صفحه‌ی `/site-inactive`)

صفحه‌ی تعلیق دلیل واقعی مسدودشدن را نشان می‌دهد — یک کد کوچک لاتین زیر پیام:

| کد روی صفحه | معنا | کار |
| --- | --- | --- |
| `domain` | دامنه‌ی درخواست resolve نشد (پراکسی هدر Host را نمی‌رساند یا درخواست با IP/localhost است) | پراکسی: `proxy_set_header Host $host;` — برای تست محلی `SHOP_DOMAIN` |
| `db` | لایسنس تأیید شد ولی فایل دیتابیس همان دامنه روی سرور نیست | وضعیت provision دامنه در Core (ستون «دیتابیس» = ready) و mount حجم داده |
| `license:down` | Core در دسترس نیست یا کلید/آدرس اشتباه است | `CORE_API_URL`/`CORE_API_KEY` و شبکه‌ی کانتینرها |
| `license:unknown` | Core برای همین دامنه «ثبت‌نشده» پاسخ داد | دامنه‌ی resolveشده (کنار کد چاپ می‌شود) را با دامنه‌ی ثبت‌شده در Core مقایسه کنید |
| `license:inactive/suspended/expired` | وضعیت دامنه/پلن در Core | همان دامنه را در پنل Core فعال/تمدید کنید |

هر فروشگاه مستقل است: استعلام لایسنس، کش ۱۵ دقیقه‌ای، دیتابیس و آپلودها
همه **per-domain** هستند و مسدودشدن یک دامنه روی بقیه اثری ندارد.

### دیدن علت دقیق (بدون حدس)

مسیر `GET /api/core/diagnostics` با هدر `x-core-key` همان کلید مشترک، وضعیت
همان دامنه را برمی‌گرداند: دامنه‌ی resolveشده، پاسخ واقعی Core (بدون کش)،
مسیر/وجود پوشه و فایل دیتابیس همان دامنه و یک `verdict` نهایی (فهرست دامنه‌های
دیگر سرور عمداً برنمی‌گردد). این مسیر از گیت لایسنس بیرون است (زیر
`/api/core`)، پس حتی وقتی سایت مسدود است هم پاسخ می‌دهد و به هیچ دیتابیسی دست
نمی‌زند.

```bash
# از روی سرور/لپ‌تاپ (nginx یا پورت مستقیم):
curl -s -H "x-core-key: $CORE_API_KEY" \
  "https://shop140.ir/api/core/diagnostics?domain=shop140.ir"
```

```bash
# از داخل کانتینر فروشگاه (Podman):
podman exec alazcore-shop node -e \
  "fetch('http://127.0.0.1:3000/api/core/diagnostics?domain=shop140.ir',{headers:{'x-core-key':process.env.CORE_API_KEY}}).then(r=>r.text()).then(console.log)"
```

نمونه‌ی پاسخ کوتاه‌شده:

```json
{
  "domain": "shop140.ir",
  "verdict": "db-missing",
  "core": { "reachable": true, "httpStatus": 200, "ok": true, "status": "active" },
  "siteDb": {
    "absolutePath": "/app/data/sites/shop140.ir/shop140.ir.db",
    "dirExists": false,
    "exists": false
  }
}
```

یعنی: لایسنس `shop140.ir` در Core سالم است، اما روی این سرور حتی پوشه‌ی همان
دامنه هم نیست (provision به مسیر دیگری رفته یا حجم داده درست mount نشده) — نه
اینکه دامنه ثبت نشده باشد. اگر `dirExists: true` ولی `exists: false` باشد،
پوشه ساخته شده ولی فایل دیتابیس نیمه‌کاره مانده است.

برای حریم خصوصی، این مسیر فهرست دامنه‌های دیگر روی سرور را برنمی‌گرداند.

مقدارهای `verdict` (با خط تیره، معادل کدهای صفحه): `domain-not-resolved`،
`core-not-configured`، `core-unreachable-closed`، `core-unreachable-open`،
`core-key-rejected`، `core-error` (Core پاسخ معتبر نداد)، `license-unknown`،
`license-inactive`، `license-suspended`، `license-expired`، `db-missing`،
`ok` — و فیلد `hint` همان‌جا می‌گوید چه کاری لازم است.

لاگ سرور هم برای هر دامنه یک خط می‌گذارد: `podman logs alazcore-shop | grep site-block`.

## ۶) معماری در یک نگاه

```
core/                          ← اپ مستقل Next.js (پورت 3100)
  prisma/schema.prisma         ← دیتابیس جدا: core/data/core.db
  app/panel/*                  ← صفحات پنل (داشبورد/دامین/پلن/تم/تیکت/کاربر/تنظیمات)
  app/api/validate             ← سرویس اعتبارسنجی لایسنس برای فروشگاه‌ها
  lib/licensing.ts             ← منطق وضعیت دامنه و ساخت snapshot

فروشگاه (ریشه ریپو)
  proxy.ts                     ← چک لایسنس + ریدایرکت تعلیق + گیت منوهای پلن
  lib/core-license.ts          ← کلاینت /api/validate با کش ۱۵ دقیقه‌ای per-domain
  lib/site-block.ts            ← دلیل مسدودسازی → پیام دقیق صفحه‌ی تعلیق
  app/site-inactive/           ← صفحه تعلیق سایت (با کد دلیل)
  app/api/core/diagnostics/    ← عیب‌یابی دامنه/Core/دیتابیس (x-core-key)
  app/(app)/layout.tsx         ← فیلتر منوهای ادمین بر اساس پلن Core
```

---

## ۷) Multi-tenancy دیتابیس سایت‌ها

هر دامنه‌ی ثبت‌شده در پنل Core، هنگام ثبت یک **پوشه و دیتابیس اختصاصی** در اپ
فروشگاه می‌گیرد: `data/sites/{دامنه- sanitized}/{دامنه}.db` (مثل
`data/sites/joghd.ir/joghd.ir.db`). نام دقیق در ستون «دیتابیس» مدیریت
دامنه‌ها ثبت و نمایش داده می‌شود؛ اگر provision آن لحظه شکست خورد، وضعیت
«pending» می‌ماند و با دکمه/تلاش مجدد (POST /api/domains/{id}) ساخته می‌شود.

- دیتابیس جدید **خالی + ادمین پیش‌فرض دامنه‌ای** است: `admin@{دامنه}` با رمز
  admin1234 (مثل admin@shop2.ir) — همان لحظه‌ی ثبت دامنه ساخته می‌شود؛
  اعتبارنامه (نام کاربری + رمز پیش‌فرض + بازنشانی) در صفحه‌ی ویرایش دامنه‌ی
  پنل Core نمایش داده می‌شود. آپلودهای هر سایت هم در
  `data/sites/{دامنه}/uploads` جدا هستند.
- اپ فروشگاه به‌صورت داینامیک بر اساس دامنه‌ی درخواست به دیتابیس همان سایت
  وصل می‌شود (AsyncLocalStorage از proxy با Node runtime)؛ در production
  دامنه فقط از هدر Host خوانده می‌شود.
- **مایگریشن داده‌محفوظ**: تغییر schema فروشگاه → در اپ فروشگاه
  `npm run db:site-migration -- <نام>` (فایل `prisma/site-migrations/NNNN_*.sql`
  می‌سازد و site-schema.sql را بازتولید می‌کند) → بعد از پابلیش، entrypoint
  فروشگاه پیش از next start همه‌ی دیتابیس‌های سایت‌ها را به‌روز می‌کند
  (دستی: `npm run db:migrate-sites`). ledger نسخه‌ی هر دیتابیس در جدول
  `_SiteMigration` همان دیتابیس است.
- DDL از آرتیفکت کامیت‌شده‌ی `prisma/site-schema.sql` اجرا می‌شود (بازتولیدش
  با `npm run db:site-migration` همراه مایگریشن خودکار انجام می‌شود).
- rename دامنه در Core، دیتابیس موجود را جابه‌جا نمی‌کند (نام هنگام ساخت ثابت است).
- پشتیبان‌گیری: علاوه بر core.db، پوشه‌ی `data/sites/` اپ فروشگاه هم بایگانی شود.
