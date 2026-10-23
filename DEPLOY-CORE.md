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
# در production نادیده گرفته می‌شود و دامنه همیشه از هدر Host می‌آید.
CORE_FAIL_MODE=open         # open = اگر Core در دسترس نبود باز بماند
```

اثر اتصال (فروشگاه):
- اعتبارسنجی دامنه در production اجباری است — دامنه غیرفعال/معلق/منقضی/
  ثبت‌نشده (و حتی کورِ پیکربندی‌نشده با CORE_FAIL_MODE=closed) → به
  `/site-inactive` می‌رود؛ APIهای همان دامنه هم 503 می‌گیرند.
- منوهای پنل ادمین = اشتراک نقش داخلی و منوهای پلن Core؛ تنظیمات
  درگاه/اقساط/پیامک فقط وقتی می‌مانند که Core برای آن دامنه فعال کرده باشد.
- بدون این متغیرها فروشگاه دقیقاً مثل قبل و مستقل کار می‌کند.

کش لایسنس ۵ دقیقه در حافظه است؛ تغییر وضعیت در Core حداکثر ۵ دقیقه بعد
اعمال می‌شود.

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
- [ ] غیرفعال‌کردن دامنه در Core → حداکثر ۵ دقیقه بعد سایت روی `/site-inactive` می‌رود

## ۶) معماری در یک نگاه

```
core/                          ← اپ مستقل Next.js (پورت 3100)
  prisma/schema.prisma         ← دیتابیس جدا: core/data/core.db
  app/panel/*                  ← صفحات پنل (داشبورد/دامین/پلن/تم/تیکت/کاربر/تنظیمات)
  app/api/validate             ← سرویس اعتبارسنجی لایسنس برای فروشگاه‌ها
  lib/licensing.ts             ← منطق وضعیت دامنه و ساخت snapshot
م.EventQueue
فروشگاه (ریشه ریپو)
  proxy.ts                     ← چک لایسنس + ریدایرکت تعلیق + گیت منوهای پلن
  lib/core-license.ts          ← کلاینت /api/validate با کش ۵ دقیقه
  app/site-inactive/           ← صفحه تعلیق سایت
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
