# راهنمای استقرار روی سرور (Deployment)

این سند مراحل منتشر کردن فروشگاه روی یک سرور لینوکسی (VPS) را از صفر تا حال،
تا اجرای پشت nginx با SSL، قدم‌به‌قدم توضیح می‌دهد. برای هر بخش، فرمان‌های
دقیق همراه شده‌اند.

---

## ۰) چه چیزهایی این پروژه برای اجرا لازم دارد

| نیازمندی                  | توضیح                                                       |
| ------------------------- | ----------------------------------------------------------- |
| Node.js **≥ 20.9**        | Next.js 16 این حداقل را دارد (در `engines` پکیج هم قید شده) |
| دیتابیس                   | SQLite — فایل `data/app.db`؛ هیچ سرور دیتابیسی لازم نیست    |
| متغیر محیطی `AUTH_SECRET` | **تنها متغیر اجباری**؛ کلید امضای کوکی نشست                 |
| پوشه‌ی قابل‌نوشتن `data/` | دیتابیس + عکس‌های آپلودی (`data/uploads/`) اینجا می‌نشینند  |

نکته‌های مهم:

- `DATABASE_URL` در `prisma/schema.prisma` هاردکد شده است
  (`file:../data/app.db`) — یعنی **هیچ تنظیم اتصال دیتابیس لازم نیست.**
- اگر `AUTH_SECRET` ست نشده باشد یا کمتر از ۱۶ نویسه باشد، سرور در حالت
  production بالا نمی‌آید و خطا می‌دهد (این رفتار عمدی است، در `lib/session.ts`).
  `next build` بدون آن هم می‌چسبد؛ فقط `next start` آن را می‌خواهد.
- عوض کردن `AUTH_SECRET` بعداً، همه‌ی نشست‌های امضاشده را بی‌اعتبار می‌کند
  (همه — ادمین و مشتری — از حساب بیرون می‌روند).

---

## ۱) آماده کردن سرور (یک بار)

روی سرور اوبونتو/دبیان:

```bash
# Node.js 20 از مخزن رسمی NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx

node -v   # باید v20.9 یا بالاتر باشد

# PM2 برای اجرای دائمی (در صورت انتخاب PM2 — بنگر بخش ۶)
sudo npm i -g pm2
```

فایروال:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## ۲) انتقال کد به سرور

### گزینه الف — با گیت (پیشنهادی)

روی سیستم خودتان (پوشه‌ی پروژه فعلاً گیت ندارد):

```powershell
git init
git add -A
git commit -m "Initial release"
# یک ریپو بسازید (GitHub/GitLab/گیت سرور خودتان) و پوش کنید:
git remote add origin <آدرس-ریپو>
git push -u origin main
```

`.gitignore` از قبل درست تنظیم شده: `node_modules/`، `.next/`، `.env`،
`data/app.db` و محتویات `data/uploads/` منتقل **نمی‌شوند** (این‌ها خروجی
ساخت یا داده‌ی زمان اجرا هستند، نه سورس).

روی سرور:

```bash
sudo mkdir -p /var/www/shop && sudo chown $USER /var/www/shop
git clone <آدرس-ریپو> /var/www/shop
cd /var/www/shop
```

### گزینه ب — بدون گیت (زیپ)

روی ویندوز، یک زیپ بدون `node_modules` و `.next` بسازید (PowerShell):

```powershell
$dest = "$env:TEMP\shop-src"
Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue
# همه‌چیز به‌جز پوشه‌های حجیم/تولیدی را کپی کنید
robocopy . $dest /E /XD node_modules .next .claude-tmp-images /XF "*.tsbuildinfo"
Compress-Archive -Path $dest -DestinationPath "$env:USERPROFILE\Desktop\shop-src.zip"
```

سپس `shop-src.zip` را با SCP به سرور بفرستید و باز کنید:

```bash
unzip shop-src.zip -d /var/www/shop
```

### کپی داده‌های فعلی (اختیاری ولی معمولاً لازم)

تصمیم مهم: دیتابیسِ همین سیستم توسعه را می‌خواهید یا نه؟

- **دیتای دمو کافی است** → کاری لازم نیست؛ در بخش ۴ `db:push` + `db:seed`
  را می‌زنید.
- **دیتای واقعی همین الان در `data/app.db` است** (تنظیمات درگاه پرداخت،
  کاربران، محصولات و…) → فایل را جداگانه کپی کنید:

  ```powershell
  scp .\data\app.db user@SERVER:/var/www/shop/data/app.db
  scp -r .\data\uploads\* user@SERVER:/var/www/shop/data/uploads/
  ```

  (عکس‌های آپلودشده در `data/uploads/` هستند — بدون آن‌ها محصولاتِ منتقل‌شده
  عکس ندارند.)

---

## ۳) نصب وابستگی‌ها

روی سرور، در پوشه‌ی پروژه:

```bash
npm ci          # postinstall خودش prisma generate را اجرا می‌کند
```

> اگر `npm ci` روی `package-lock.json` گیر داد (مثلاً قفل‌فایل نیست)،
> `npm install` بزنید.

---

## ۴) متغیر محیطی و دیتابیس

### AUTH_SECRET

```bash
cd /var/www/shop
cp .env.example .env
openssl rand -base64 32   # خروجی را کپی کنید
nano .env                 # AUTH_SECRET=<خروجی بالا>
chmod 600 .env
```

### ساخت دیتابیس

اگر `app.db` را کپی نکرده‌اید (شروع تازه):

```bash
npm run db:push    # جداول را از روی schema می‌سازد (بدون فایل migration)
npm run db:seed    # حساب‌های دمو + محصولات و سفارش‌های نمونه
```

اگر `app.db` را کپی کرده‌اید، فقط اگر بعداً schema عوض شد:

```bash
npm run db:push    # جداول جدید/تغییر یافته را اعمال می‌کند؛ دیتا می‌ماند
```

> **هشدار:** `db:seed` جدول سفارش‌ها و محصولات را پاک و از نو می‌سازد —
> روی دیتابیس واقعی فقط وقتایی اجرایش کنید که از اول می‌خواهید شروع کنید.

حساب‌های seed شده:

| حساب       | ایمیل / موبایل      | رمز          |
| ---------- | ------------------- | ------------ |
| مدیر کل    | `admin@mantine.dev` | `admin1234`  |
| کارمند دمو | `user@mantine.dev`  | (مطابق seed) |

پس از اولین ورود، رمز ادمین را از صفحه‌ی تنظیمات عوض کنید.

---

## ۵) بیلد

```bash
npm run build
```

---

## ۶) اجرای دائمی

### گزینه الف — PM2 (ساده)

```bash
cd /var/www/shop
pm2 start npm --name shop -- start     # پورت پیش‌فرض 3000
pm2 save
pm2 startup                            # فرمان خروجی را با sudo اجرا کنید
```

لاگ‌ها: `pm2 logs shop` — ری‌استارت: `pm2 restart shop`

### گزینه ب — systemd (بدون نصب چیز اضافه)

`/etc/systemd/system/shop.service`:

```ini
[Unit]
Description=Shop (Next.js)
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/shop
ExecStart=/usr/bin/npm run start
Environment=NODE_ENV=production
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo chown -R www-data:www-data /var/www/shop/data   # نوشتن app.db و uploads
sudo systemctl daemon-reload
sudo systemctl enable --now shop
sudo systemctl status shop
```

---

## ۷) nginx + SSL

`/etc/nginx/sites-available/shop`:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;   # ← دامنه‌ی خودتان

    client_max_body_size 10m;   # آپلود عکس (سقف API هم ۵ مگابایت است)

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/shop /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# SSL رایگان با certbot
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
```

> هدرهای `X-Forwarded-*` مهم‌اند: فید تروب (`/api/torob/feed`) و آدرس‌های
> بازگشت درگاه‌های پرداخت را از `request.nextUrl.origin` می‌سازند؛ بدون این
> هدرها، آدرس‌ها به‌جای دامنه‌ی شما `http://127.0.0.1:3000` درمی‌آیند.

---

## ۸) پشتیبان‌گیری

دو چیز ارزشمندند: فایل دیتابیس و عکس‌ها — هردو داخل `data/`:

```bash
# پشتیبان سریع (کپی امن SQLite با VACUUM INTO)
sqlite3 /var/www/shop/data/app.db "VACUUM INTO '/backup/app-$(date +%F).db'"
tar -czf "/backup/uploads-$(date +%F).tar.gz" -C /var/www/shop/data uploads
```

این دو فرمان را در یک cron روزانه بگذارید. `AUTH_SECRET` را هم جایی امن
یادداشت کنید (اگر گم شود، با کلید جدید همه نشست‌ها بی‌اعتبار می‌شوند).

---

## ۹) چک‌لیست پس از استقرار

- [ ] `https://دامنه` باز می‌شود و به `/login` می‌رسد
- [ ] ورود ادمین (`admin@mantine.dev` / رمز) کار می‌کند — بعدش رمز را عوض کنید
- [ ] یک محصول با عکس ویرایش/ساخت می‌کند و عکس در `/api/files/...` رندر می‌شود
- [ ] ورود مشتری و ثبت یک سفارش نمونه
- [ ] تنظیمات درگاه پرداخت و پیامک از پنل ادمین چک شود (کلیدها داخل
      `data/app.db` هستند و با کپی دیتابیس منتقل شده‌اند)
- [ ] یک لینک پرداخت تستی ساخته و باز شود (callback به دامنه‌ی درست برمی‌گردد)
- [ ] `pm2 logs shop` (یا `journalctl -u shop`) بدون خطا
- [ ] پشتیبان‌گیری cron فعالی دارد

---

## ۱۰) به‌روزرسانی نسخه‌ی بعدی

```bash
cd /var/www/shop
git pull            # یا زیپ جدید
npm ci
npm run db:push     # اگر schema تغییری داشته باشد
npm run build
pm2 restart shop    # یا: sudo systemctl restart shop
```

---

## اشتباه‌های رایج

| نشانه                                               | علت                                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| سرور بالا نمی‌آید با خطای `AUTH_SECRET is missing…` | `.env` ساخته نشده یا کلید < ۱۶ نویسه است — بخش ۴                                 |
| ورود کار می‌کند ولی بعد از چند دقیقه بیرون می‌افتد  | `AUTH_SECRET` بین ری‌استارت‌ها عوض شده (مثلاً هر بار مقدار تصادفی جدید)          |
| عکس‌های آپلودی 404 می‌دهند                          | `data/uploads/` منتقل نشده یا کاربر سرویس اجازه‌ی نوشتن ندارد (`chown www-data`) |
| بازگشت از درگاه پرداخت به `127.0.0.1:3000` می‌رود   | هدرهای `X-Forwarded-*` در nginx ست نشده‌اند — بخش ۷                              |
| خطای Prisma هنگام اجرا                              | `postinstall` اجرا نشده؛ `npx prisma generate` را بزنید                          |
