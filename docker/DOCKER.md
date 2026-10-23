# راهنمای Docker — اجرای فروشگاه + پنل Core با Docker

این سند برای کسی نوشته شده که Docker بلد نیست و از صفر می‌خواهد پروژه را با
Docker اجرا کند — روی ویندوز همین سیستم، یا روی سرور لینوکسی (VPS). همه‌ی
فرمان‌ها دقیق و کپی‌شدنی‌اند.

اگر فقط می‌خواهید روی سرور به روش قدیمی (بدون Docker) مستقر کنید، سند
[DEPLOY.md](DEPLOY.md) و [DEPLOY-CORE.md](DEPLOY-CORE.md) همان کار را با
Node.js + PM2 انجام می‌دهند. نتیجه‌ی هر دو روش یکی است.

---

## ۰) چهار مفهوم که کافی است بدانید

| مفهوم | یعنی چه | در این پروژه |
| --- | --- | --- |
| **Image** | بسته‌ی آماده‌ی اجرای اپ — مثل «نصب‌کننده‌ی خاموش». از روی کد ساخته می‌شود (`docker build`). | دو image داریم: `alazcore-shop` و `alazcore-core` |
| **Container** | یک نمونه‌ی در حال اجرای image — مثل «برنامه‌ی بازشده». پاک کردنش اپ را می‌بندد، نه دیتا را. | دو container: `alazcore-shop` و `alazcore-core` |
| **Volume / Bind mount** | پوشه‌ای **خارج از container** که دیتای ماندگار در آن نوشته می‌شود. با حذف/rebuild container دیتا می‌ماند. این پروژه از **bind mount** استفاده می‌کند: پوشه‌ی واقعی ویندوز/لینوکس، قابل دیدن در Explorer | `D:\AliMost\NextTest\Github\DockerVolume\Shop` (دیتابیس+آپلودهای فروشگاه و سایت‌ها) و `D:\AliMost\NextTest\Github\DockerVolume\Core` (دیتابیس+آپلودهای پنل Core) |
| **docker compose** | ابزاری که چند container را با یک فایل تنظیمات (`docker-compose.yml`) یک‌جا بالا می‌آورد. | کل استک با `docker compose up -d` اجرا می‌شود |

**قاعده‌ی طلایی:** کد و برنامه داخل image است، دیتا (دیتابیس‌ها و عکس‌های
آپلودی) داخل volume است. Image را هر بار عوض کنید، دیتا سرِ جایش می‌ماند.

> ⚠️ **کانتینر را از دکمه‌ی Run داخل Docker Desktop بالا نیاورید** — آن کانتینر
> نه متغیرهای `docker.env` را دارد (لاگین با خطای «خطای شبکه» می‌شکند) نه
> mount درست. فقط و فقط از داخل پوشه‌ی ریپو با `docker compose up -d` اجرا کنید.

---

## نقشه‌ی کلی چیزی که ساخته می‌شود

| Image | اپ | پورت | پوشه‌ی دیتای ماندگار (bind mount) |
| --- | --- | --- | --- |
| `alazcore-shop:1.1.0` | فروشگاه (ریشه‌ی ریپو) | `3000` | `D:\AliMost\NextTest\Github\DockerVolume\Shop` → داخل کانتینر `/app/data` |
| `alazcore-core:1.1.0` | پنل Core (پوشه‌ی `core/`) | `3100` | `D:\AliMost\NextTest\Github\DockerVolume\Core` → داخل کانتینر `/app/data` |

داخل هر پوشه چه چیزی می‌بینید:

```
DockerVolume\Shop\        ← دیتای فروشگاه
   app.db                 ← دیتابیس اصلی فروشگاه
   sites\                 ← دیتابیس/آپلود اختصاصی هر دامنه (multi-tenant)
   uploads\               ← عکس‌های آپلودی
DockerVolume\Core\        ← دیتای پنل Core
   core.db                ← دیتابیس پنل
   uploads\               ← لوگو/آواتارهای پنل
```

- پنل Core علاوه بر volume خودش، volume دیتای فروشگاه را هم می‌بیند تا هنگام
  **ثبت دامنه‌ی جدید**، دیتابیس اختصاصی همان سایت را داخل دیتای فروشگاه بسازد
  (همان پروویژنِ همیشه — استثنای قاعده‌ی API-only).
- هر دو اپ در یک شبکه‌ی داخلی Docker حرف هم را می‌زنند: فروشگاه با
  `CORE_API_URL=http://core:3100` لایسنس چک می‌کند، پنل Core با
  `SHOP_API_URL=http://shop:3000` گزارشات را می‌خواند — این دو مقدار را تغییر ندهید.
- در هر استارت container، entrypoint اول `prisma db push` می‌زند (schema جدید
  خودکار اعمال می‌شود)، و فقط اگر volume خالی باشد (بوت اول) داده‌ی دمو +
  حساب ادمین seed می‌کند.

---

## ۱) نصب Docker

### روی ویندوز (همین سیستم)

1. اگر هنوز نصب نیست: **Docker Desktop for Windows** را از
   [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
   بگیرید و نصب کنید (WSL2 را هم فعال می‌خواهد — نصب‌کننده خودش راهنمایی می‌کند).
2. بعد از نصب، **Docker Desktop را باز کنید** و صبر کنید بالا بیاید — آیکون
   نهک (whale) در system tray باید ثابت شود. Docker فقط وقتی کار می‌کند که
   این برنامه روشن باشد.
3. چک کنید (در PowerShell یا Git Bash):

```bash
docker version          # باید Server version نشان دهد
docker compose version  # باید v2.x.x نشان دهد
```

### روی سرور اوبونتو/دبیان (VPS)

```bash
curl -fsSL https://get.docker.com | sh
docker version   # چک
```

---

## ۲) ساخت فایل تنظیمات (`docker.env`)

در ریشه‌ی ریپو:

```bash
cp docker.env.example docker.env
```

بعد `docker.env` را باز کنید و حداقل **سه کلید تصادفی** را پر کنید:

```bash
openssl rand -base64 32   # خروجی را برای AUTH_SECRET
openssl rand -base64 32   # خروجی را برای CORE_AUTH_SECRET
openssl rand -base64 32   # خروجی را برای CORE_API_KEY
```

(در ویندوز، Git Bash دستور `openssl` را دارد. در PowerShell می‌توانید به‌جایش
این را بزنید: `-join ((48..57)+(97..122) | Get-Random -Count 40 | % {[char]$_})`)

| متغیر | کدام اپ | توضیح |
| --- | --- | --- |
| `AUTH_SECRET` | فروشگاه | کلید امضای کوکی نشست — اجباری |
| `CORE_AUTH_SECRET` | پنل Core | کلید امضای کوکی نشست پنل — اجباری |
| `CORE_API_KEY` | هر دو | کلید مشترک API بین فروشگاه و Core — اجباری |
| `CORE_API_URL` / `SHOP_API_URL` | — | آدرس‌دهی داخل شبکه‌ی Docker — **تغییر ندهید** |
| `SHOP_DOMAIN` | فروشگاه | معمولاً خالی (دامنه از هدر nginx خوانده می‌شود) |
| `CORE_FAIL_MODE` | فروشگاه | اگر Core نبود: `open` = باز بماند، `closed` = مسدود |
| `SEED_ON_FIRST_BOOT` | هر دو | بوت اول روی volume خالی، داده‌ی دمو seed شود؟ |
| `TZ` | هر دو | منطقه زمانی — پیش‌فرض `Asia/Tehran` |

نکته: عوض کردن `AUTH_SECRET` بعداً همه‌ی نشست‌ها را بی‌اعتبار می‌کند (همه از
حساب بیرون می‌روند) — یک بار بسازید و نگه دارید. فایل `docker.env` سکرت دارد
و در `.gitignore` است؛ هرگز کامیت یا برای کسی نفرستید.

---

## ۳) بیلد دو image

در ریشه‌ی ریپو (بیلد باید از ریشه باشد — image کور به فایل
`prisma/site-schema.sql` فروشگاه نیاز دارد):

```bash
docker compose build
```

چند دقیقه طول می‌کشد (نصب وابستگی‌ها + `next build` هر دو اپ داخل image).
بعد از تمام شدن، imageها این‌جا زندگی می‌کنند:

```bash
docker images
# alazcore-shop   1.1.0   ...
# alazcore-core   1.1.0   ...
```

> Image به‌صورت پیش‌فرض **یک چیز داخل Docker است، نه یک فایل در ویندوز**.
> اگر فایلش را می‌خواهید (مثلاً برای انتقال به سرور)، بخش ۵ را ببینید.

بیلد جداگانه‌ی هر کدام (اگر لازم شد):

```bash
docker build -f docker/Dockerfile.shop -t alazcore-shop:1.1.0 .
docker build -f docker/Dockerfile.core -t alazcore-core:1.1.0 .
```

---

## ۴) خروجی گرفتن image به فایل (D:\AliMost\NextTest\Github)

برای اینکه دو image به‌صورت فایل `.tar` ذخیره شوند (مثلاً برای کپی با فلش یا
SCP به سرور):

```bash
docker save -o "D:\AliMost\NextTest\Github\alazcore-shop-1.1.0.tar" alazcore-shop:1.1.0
docker save -o "D:\AliMost\NextTest\Github\alazcore-core-1.1.0.tar" alazcore-core:1.1.0
```

و روی مقصد (هر سیستمی که Docker دارد) بازگرداندن:

```bash
docker load -i alazcore-shop-1.1.0.tar
docker load -i alazcore-core-1.1.0.tar
docker images   # حالا همان دو image موجودند
```

روی **سرور اصلی (ویندوز با Podman)** همین دو فایل با Podman بازمی‌گردند —
فرمت tar سازگار است و `podman load` همان دو image را می‌سازد:

```bash
podman load -i alazcore-shop-1.1.0.tar
podman load -i alazcore-core-1.1.0.tar
podman images
```

هر دو فایل چند صد مگابایت هستند — برای انتقال به سرور به‌جای فلش، از
`scp alazcore-shop-1.1.0.tar user@server:/opt/` استفاده کنید.

---

## ۵) اجرا

```bash
docker compose up -d     # هر دو container در پس‌زمینه بالا می‌آیند
docker compose ps        # وضعیت — بعد از ~۱ دقیقه هر دو Up (healthy)
docker compose logs -f   # لاگ زنده (Ctrl+C فقط از لاگ بیرون می‌آید)
```

- فروشگاه: `http://localhost:3000`
- پنل Core: `http://localhost:3100`

بوت اول روی volume خالی، خودکار: schema اعمال می‌شود، داده‌ی دمو seed می‌شود،
و حساب‌های ادمین ساخته می‌شوند:

| اپ | حساب | رمز اولیه (همان را بعد از ورود عوض کنید) |
| --- | --- | --- |
| فروشگاه | `admin@mantine.dev` | `admin1234` |
| پنل Core | `admin@alazcore.ir` | `admin1234` |

دامنه‌ی هر سایت در production از **هدر Host درخواست** خوانده می‌شود — nginx
باید `proxy_set_header Host $host;` بگذارد (بخش ۸). هر دامنه‌ای که در پنل Core
ثبت/فعال شده باشد، با همان دامنه به فروشگاه برسد با دیتابیس خودش بالا می‌آید
(`DockerVolume\Shop\sites\{دامنه}\{دامنه}.db`؛ توسط Core هنگام ثبت پروویژن
می‌شود و حساب ادمین `admin@{دامنه}` با رمز `admin1234` همان‌جا ساخته و در
صفحه‌ی ویرایش دامنه نمایش داده می‌شود). دامنه‌ای که ثبت نشده یا دیتابیسش
آماده نیست به `/site-inactive` می‌رود — هیچ‌وقت دیتابیس سایت دیگری سرو نمی‌شود.
متغیر `SHOP_DOMAIN` فقط مخصوص توسعه/تست محلی است و در `docker.env` جایی ندارد.

### توقف / حذف

```bash
docker compose stop      # خاموش کردن — container و دیتا می‌مانند
docker compose start     # روشن دوباره
docker compose down      # حذف containerها — دیتا در پوشه‌ی DockerVolume می‌ماند
```

> حتی `docker compose down -v` هم با bind mount پوشه‌ی `DockerVolume` را پاک
> نمی‌کند — دیتای شما فقط با پاک‌کردن دستی آن پوشه از بین می‌رود. مراقب باشید
> آن پوشه را «فایل اضافی» ندانید و پاک نکنید!

---

## ۶) دیتای شما کجاست؟ (پوشه‌های volume و بکاپ)

دیتابیس‌ها و آپلودها **خارج از container** در پوشه‌ی ویندوزی می‌نشینند و با
هر rebuild یا `docker compose down`، سر جایشان می‌مانند:

```text
D:\AliMost\NextTest\Github\DockerVolume\Shop     ← app.db + sites\ + uploads\
D:\AliMost\NextTest\Github\DockerVolume\Core     ← core.db + uploads\
```

همین‌ها را مستقیم در Explorer می‌بینید و می‌توانید کپی کنید. اگر خواستید
جای پوشه‌ها را عوض کنید، در `docker-compose.yml` مقدار پیش‌فرض
`DOCKER_DATA_DIR` را تغییر دهید (یا قبل از `up` همین متغیر را ست کنید).
روی سرور لینوکسی مثلاً: `DOCKER_DATA_DIR=/srv/alazcore` در همان فایل.

**سرور اصلی (ویندوز + Podman):** مسیر volumeها `C:\inetpub\Podman\Volumes` است
با دو پوشه‌ی جداگانه‌ی `Core` و `Shop` — یعنی همان ساختار بالا
(`Volumes\Shop\app.db` + `sites\` + `uploads\` و `Volumes\Core\core.db` + `uploads\`).
چون `DOCKER_DATA_DIR` متغیرِ خود compose است (نه متغیر داخل container)، آن را
داخل `docker.env` ننویسید؛ یا قبل از `up` در همان پنجره‌ی فرمان ست کنید:

```bash
DOCKER_DATA_DIR="C:/inetpub/Podman/Volumes" docker compose up -d
```

یا به‌صورت دائمی، فایل `.env` کنار `docker-compose.yml` بسازید با همین یک خط:
`DOCKER_DATA_DIR=C:/inetpub/Podman/Volumes`

نکته: روی ویندوز، این پوشه‌ها از طریق لایه‌ی WSL2 سوار می‌شوند — برای
SQLite کمی کندتر از volume داخلی داکر است ولی برای این اپ (تعداد کاربر
محدود) کاملاً کافی است. روی سرور لینوکس، مسیرهای bind mount بومی و سریع‌اند.

### بکاپ‌گیری

ساده‌ترین راه: کانتینرها را stop کنید و از همین دو پوشه کپی بگیرید:

```bash
docker compose stop
# پوشه‌ی DockerVolume را کپی/زیپ کنید
docker compose start
```

بدون توقف (سرور — بکاپ سازگار SQLite برای دیتابیس‌ها):

```bash
docker exec alazcore-shop sh -c "sqlite3 /app/data/app.db \"VACUUM INTO '/tmp/app.db'\"" \
 && docker cp alazcore-shop:/tmp/app.db ./app-backup.db
```

(فایل `sites\` هر دامنه هم همین‌طور؛ یا همان روش کپی پوشه با tar — بخش ۶
قبلی — هم روی پوشه‌ی bind کار می‌کند.)

ریستور: کانتینر stop، فایل‌ها را در پوشه بریزید، start.

---

## ۷) انتقال دیتای فعلی سیستم توسعه به volume (اختیاری)

اگر همین الان در سیستم توسعه‌تان دیتای واقعی دارید (`data/app.db` با محصولات،
تنظیمات درگاه و…) و می‌خواهید در نسخه‌ی Docker هم باشد — چون دیتا حالا پوشه‌ی
ویندوزی معمولی است، کافی است فایل‌ها را همان‌جا بریزید:

```bash
docker compose stop

# دیتای فروشگاه
mkdir -p "D:/AliMost/NextTest/Github/DockerVolume/Shop"
cp data/app.db  "D:/AliMost/NextTest/Github/DockerVolume/Shop/"
cp -r data/uploads/. "D:/AliMost/NextTest/Github/DockerVolume/Shop/uploads/" 2>/dev/null
cp -r data/sites/.   "D:/AliMost/NextTest/Github/DockerVolume/Shop/sites/"   2>/dev/null

# دیتای پنل Core (اگر دارد)
mkdir -p "D:/AliMost/NextTest/Github/DockerVolume/Core"
cp core/data/core.db "D:/AliMost/NextTest/Github/DockerVolume/Core/" 2>/dev/null

docker compose start
```

(به‌جای این فرمان‌ها، کپی با Explorer هم می‌شود — فقط کانتینرها stop باشند.)

نکته: کلیدهای درگاه پرداخت و پنل پیامک داخل دیتابیس‌اند — با همین کپی منتقل
می‌شوند. و `docker.env` را همان‌طور که در بخش ۲ توضیح داده شده، پر کنید.

---

## ۸) استقرار روی سرور + دامنه + SSL

روی سرور، بعد از `docker load` (بخش ۴) و ساخت `docker.env` (بخش ۲):

```bash
docker compose up -d
```

nginx و SSL دقیقاً مثل بخش ۷ از DEPLOY.md — فقط مقادیر:

- فروشگاه: `proxy_pass http://127.0.0.1:3000;`
- پنل Core (زیردامنه مثل `core.example.com`): `proxy_pass http://127.0.0.1:3100;`
- هدرهای `X-Forwarded-*` را حتماً بگذارید (بازگشت درگاه پرداخت و فید تروب به آن‌ها وابسته است)
- `client_max_body_size 10m;` برای آپلود عکس

فایروال: پورت‌های 3000/3100 لازم نیست به بیرون باز شوند — nginx خودش از
localhost وصل می‌شود؛ فقط 80/443 باز باشد.

---

## ۹) به‌روزرسانی نسخه‌ی جدید

وقتی کد تغییر کرد (گیت پول شد یا فایل‌های جدید آمدند):

```bash
docker compose build     # imageهای جدید
docker compose up -d     # جایگزینی containerها با image جدید — دیتا می‌ماند
docker image prune       # پاکسازی imageهای بلااستفاده‌ی قدیمی
```

- entrypoint در استارت جدید، خودش `prisma db push` می‌زند — تغییرات schema
  بدون کار اضافه اعمال می‌شود و دیتا حفظ می‌شود.
- **مایگریشن دیتابیس‌های سایت‌ها خودکار است**: اگر `prisma/schema.prisma` تغییر
  کرده باشد، در توسعه `npx tsx scripts/new-site-migration.ts <نام>` را زده و
  فایل `prisma/site-migrations/NNNN_نام.sql` را کامیت کنید — entrypoint هر بوت
  پیش از `next start` مایگریشن‌های pending را روی همه‌ی دیتابیس‌های سایت‌ها
  اعمال می‌کند (داده‌محفوظ؛ هر فایل یک تراکنش). دستی: `docker compose exec shop npx tsx scripts/migrate-sites.ts`
- به‌همراه مایگریشن، فایل‌های `prisma/site-schema.sql` و `prisma/site-migrations/`
  هم داخل image کور به‌روز می‌شوند (پروویژن دیتابیس‌های نو به آن‌ها وابسته است) —
  یعنی image کور را هم از نو بیلد کنید.
- اگر تغییر schema «مخرب» باشد (حذف ستون/جدول)، `prisma db push` اجازه نمی‌دهد
  و container در لاگ خطا می‌دهد و بالا نمی‌آید — این عمدی است تا دیتا از دست
  نرود؛ باید آگاهانه تصمیم بگیرید. برای دیتابیس‌های سایت هم فایل مایگریشنِ مخرب
  را قبل از اعمال بازبینی کنید (اسکریپت تولید، هشدارش را می‌دهد).

---

## ۱۰) دستورات روزمره (cheat sheet)

```bash
docker compose ps                    # چه چیزی بالا است؟
docker compose logs -f shop          # لاگ زنده فروشگاه (core هم همین‌طور)
docker compose restart shop          # ری‌استارت یک اپ
docker compose exec shop sh          # ورود به داخل container فروشگاه
docker compose stats                 # مصرف CPU/RAM
docker compose down && docker compose up -d   # ری‌استارت کامل استک
```

---

## ۱۱) اشتباه‌های رایج

| نشانه | علت و راه‌حل |
| --- | --- |
| کانتینر را از دکمه‌ی **Run** داکر دسکتاپ اجرا کردم؛ صفحه می‌آید ولی لاگین «خطای شبکه» می‌دهد و در لاگ `CORE_AUTH_SECRET is missing` است | کانتینرِ UI نه `docker.env` را دارد نه mount درست. آن کانتینر را حذف کنید (`docker rm -f Core1`) و فقط از پوشه‌ی ریپو با `docker compose up -d` اجرا کنید |
| پوشه‌ی `DockerVolume` خالی است / دیتابیس «جای دیگری» نوشته می‌شود | mount باید روی مسیر `/app/data` داخل کانتینر باشد (نه مسیر دلخواه) — با `docker compose up -d` این خودکار است؛ با اجرای دستی `docker run` بدون `-v ...:/app/data` دیتا داخل لایه‌ی container می‌رود و با حذفش می‌پرد |
| `error during connect … dockerDesktopLinuxEngine` | Docker Desktop روشن نیست — برنامه را باز کنید و صبر کنید نهک ثابت شود |
| `port is already allocated` (3000 یا 3100) | سرور dev خودتان یا برنامه‌ی دیگری روی آن پورت است. آن را ببندید، یا در `docker-compose.yml` فقط سمت چپ را عوض کنید، مثل `"3001:3000"` |
| `env file … docker.env not found` | فایل `docker.env` را نساخته‌اید — بخش ۲ |
| سرور بالا نمی‌آید: `AUTH_SECRET is missing…` | یکی از سه کلید در `docker.env` خالی یا کمتر از ۱۶ نویسه است — بخش ۲ |
| container مدام ری‌استارت می‌شود | `docker compose logs shop` را ببینید؛ معمولاً خطای `prisma db push` (schema مخرب) یا env ناقص است |
| ورود کار می‌کند ولی بعد از مدتی همه بیرون می‌افتند | `AUTH_SECRET`/`CORE_AUTH_SECRET` بین ری‌استارت‌ها عوض شده (مثلاً هر بار تصادفی ساخته می‌شود) — مقدار ثابت بگذارید |
| عکس‌های آپلودی 404 می‌دهند | پوشه‌ی `DockerVolume\Shop\uploads` خالی است یا دیتای `data/uploads` منتقل نشده — بخش ۷ |
| دیتابیس سایت جدید در پنل Core «pending» می‌ماند | mount `Shop` در سرویس core درست نیست یا `prisma/site-schema.sql` قدیمی است — image کور را بعد از تولید دوباره‌ی آن فایل، از نو بیلد کنید و دکمه‌ی تلاش مجدد دامنه را بزنید |
| ساعت‌ها ۳:۳۰ اختلاف دارند | `TZ` در `docker.env` روی `Asia/Tehran` نیست |
| `bind: address already in use` روی سرور | پورت‌ها در nginx یا سرویس دیگری اشغال‌اند — mapping را در `docker-compose.yml` عوض کنید |

---

## ۱۲) چک‌لیست پس از استقرار

- [ ] `docker compose ps` هر دو سرویس را `Up (healthy)` نشان می‌دهد
- [ ] فروشگاه (`http://دامنه`) باز می‌شود و `/login` می‌آید؛ ورود ادمین کار می‌کند — بعدش رمز عوض شود
- [ ] پنل Core (`core.دامنه`) بالا است؛ ورود مدیر کل کار می‌کند — بعدش رمز عوض شود
- [ ] یک محصول با عکس ساخته شود و عکس رندر شود (آپلود در volume نوشته می‌شود)
- [ ] ثبت دامنه‌ی جدید در پنل Core → ستون «دیتابیس» `ready` شود (provision داخل Docker کار می‌کند)
- [ ] ورود مشتری + یک سفارش نمونه؛ بازگشت از درگاه پرداخت به دامنه‌ی درست
- [ ] بکاپ روزانه‌ی volumeها تنظیم شده (بخش ۶)
- [ ] `AUTH_SECRET` و `CORE_AUTH_SECRET` جایی امن ذخیره شده‌اند

---

## ۱۳) چند دامنه روی یک کانتینر (multi-tenancy با هدر Host)

**یک کانتینر فروشگاه همه‌ی دامنه‌ها را سرو می‌کند** — نیازی به کانتینر جداگانه
برای هر سایت نیست. هر درخواست با هدر Host خودش تشخیص داده می‌شود و به دیتابیس
اختصاصی همان دامنه (`DockerVolume\Shop\sites\{دامنه}\{دامنه}.db`) وصل می‌شود.
(الگوی قبلی «یک کانتینر به‌ازای هر دامنه با SHOP_DOMAIN» حذف شده است.)

### راه‌اندازی هر سایت جدید

1. **دامنه را در پنل Core ثبت و فعال کنید** — هنگام ثبت، دیتابیس اختصاصی و
   حساب ادمین `admin@{دامنه}` (رمز `admin1234`) همان‌جا ساخته می‌شود؛ اعتبارنامه
   در صفحه‌ی ویرایش دامنه قابل مشاهده/کپی است.
2. **پلن بدهید، درگاه/تم تخصیص بدهید و isActive روشن کنید.**
3. **DNS/SSL دامنه را به همین سرور ببرید** (بخش ۸) — همین؛ سایت با اولین درخواست
   معتبر بالا می‌آید.

### نکته‌های مهم

- nginx باید برای هر vhost `proxy_set_header Host $host;` داشته باشد — وگرنه
  دامنه تشخیص داده نمی‌شود و صفحه‌ی `/site-inactive` می‌بینید.
- به‌روزرسانی schema همه‌ی سایت‌ها خودکار است: در هر بوت، entrypoint پیش از
  `next start` مایگریشن‌های pending را روی همه‌ی `data/sites/…` اعمال می‌کند
  (داده‌ها حفظ می‌شوند). اجرای دستی: `docker exec alazcore-shop npx tsx scripts/migrate-sites.ts`
- لاگِ یک دامنه‌ی خاص: `docker logs alazcore-shop` (کانتینر مشترک است).
- اگر واقعاً به جداسازی کامل (کانتینر/پورت/ری‌استارت مستقل برای یک سایت) نیاز
  دارید، همان `docker-compose.yml` اصلی را با `name:` و پورت متفاوت کپی کنید —
  دامنه‌ی آن نمونه را هم باید در Core ثبت کرده باشید؛ resolution همچنان با هدر
  Host انجام می‌شود و `SHOP_DOMAIN` در آن هم اثری ندارد.
