# Task: پیاده‌سازی فرآیند تیکتینگ نسخه مرجع (TicketingSys) — 2026-10-17

## درخواست کاربر
فرآیند ticketing و پشتیبانی مطابق نسخه مرجع `AlazCore-OnlineShop-TicketingSys` در پروژه فعلی
پیاده شود — **هم جریان فروشگاه↔مشتری و هم فروشگاه↔کور**.

## سند راه‌حل (solution-architect)

**مسئله**: تیکتینگ فعلی پایه است (۴ وضعیت با pending، بدون مهمان/ویجت/خوانده‌نشده/displayId/تنظیمات/polling)؛
نسخه مرجع فرآیند کامل‌تری دارد که باید منتقل و به جریان مالک↔کور هم تعمیم یابد.

**پشته**: فقط پشته Node.js/Next.js (هر دو اپ shop و core)؛ SQLite هر دو؛ بدون وابستگی جدید.

**تصمیم‌های مصوب پلن**:
1. چرخه وضعیت ۳ حالته مرجع: پیام درخواست‌کننده → `open` (در انتظار پاسخ)، پیام پشتیبان → `answered`؛
   تیکت بسته برای پیامِ هر دو طرف قفل است و فقط پشتیبان با اکشن صریح بازگشایی می‌کند. `pending` حذف؛
   رکوردهای موجود pending → open.
2. حذف اولویت (priority) از هر دو مدل و UI — مرجع آگاهانه اولویت ندارد.
3. UI مشتری = چت مرجع (SupportChat + ویجت شناور با تنظیمات)؛ کامپوننت ژنریک پنل‌ها حفظ و توسعه می‌یابد
   (جست‌وجو، بج نخوانده مشتق، AutoRefresh، displayId، پیش‌نمایش آخرین پیام).
4. قراردادهای ریپو حفظ می‌شود: load-all بدون pagination، PanelList، فرم >۴ فیلد = صفحه،
   جزئیات موبایل = صفحه اختصاصی.

**مدل‌های تحت تاثیر**:
- `SupportTicket` (site DB): + `displayId @unique`، `userId` nullable + `guestName/guestPhone/guestToken @unique`،
  `lastMessageAt`، `lastMessageAuthor`، `customerReadAt`، `staffReadAt`؛ − `priority`؛ ایندکس status/lastMessageAt.
- `Ticket` (core DB): + `displayId @unique`، `lastMessageAt/lastMessageAuthor`، `coreReadAt/tenantReadAt`؛ − `priority`.

**قواعد کلیدی مرجع که پورت می‌شود**:
- خوانده/نخوانده مشتق است، هرگز شمارنده ذخیره‌شده نیست: آخرین پیام از سمت مقابل ∧ lastMessageAt > readAt همان سمت
  (هرگز-بازنشده = نخوانده) — در lib خالص بدون Prisma تا هر دو اپ و کلاینت یک تعریف داشته باشند.
- displayId = `TK-` + ۵ رقم تصادفی با retry برخورد.
- سقف ۵ تیکت باز به‌ازای هر حساب مشتری / مهمان (guestToken) / دامنه (سمت کور).
- MAX_SUBJECT=120، MAX_BODY=2000؛ نام نویسنده همیشه از هویت سمت سرور، هرگز از body.
- کوکی مهمان `mnt_support` (httpOnly، sameSite lax، secure در prod، ۳۰ روز) = guestToken رکورد.
- گیت `supportEnabled`: فقط مسیرهای فروشگاهی (ویجت/چت/API مشتری‌محور) را 403 می‌کند؛ پنل‌ها همیشه کار می‌کنند.
- polling همه‌جا visibility-gated: گفتگو 10s، لیست مشتری 30s، لیست پنل 20s، جزئیات context 60s.
- Context پشتیبان فقط-خواندنی است («پاسخ‌دادن به تیکت هرگز پول جابه‌جا نمی‌کند»).

**Edge Caseها**: گم‌شدن کوکی مهمان (تیکت‌های قدیمی یتیم — رفتار مرجع)، برخورد displayId (retry)،
تیکت‌های مهمان در پنل (بج «مهمان» + موبایل)، سایت تعلیق‌شده سمت کور (گیت لایسنس موجود حفظ)،
رکوردهای legacy با status=pending (نگاشت migration به open)، مسابقه markRead هم‌زمان (نوشتن timestamp آیدمپوتنت).

**ریسک‌ها**: endpoint مهمان = نوشتن ناشناس (سقف per-token + سقف طول)؛ IDOR روی [id] (فقط userId یا guestToken،
وگرنه 404)؛ بازسازی جدول SQLite (nullable userId / drop priority → بکاپ data/sites قبل از مایگریسن)؛
hardening مقایسه x-core-key با timingSafeEqual.

## وضعیت فازها
- [x] فاز ۰: برنچ + این فایل
- [x] فاز ۱: lib خالص مشترک (ticket-status، ticket-flow جدید، tickets-shared) + تست jest (۲۲ تست سبز)
- [x] فاز ۲: API فروشگاهی مشتری/مهمان + SupportChat + ویجت + /account/support
- [x] فاز ۳: بک‌آفیس فروشگاه /customer-support + API ادمین + بج نخوانده
- [x] فاز ۴: تنظیمات /settings/support + ۷ کلید + اعتبارسنجی
- [x] فاز ۵: سمت کور (core schema، API tenant/staff، پنل کور + بج، /support فروشگاه)
- [x] فاز ۶: بکاپ + مایگریشن‌ها (site-migration 0002 + db push کور) + تست دود
- [x] فاز ۷: qa (۱۸ suite / ۱۲۵ تست سبز؛ +۱۷ تست RTL ویجت/چت) → security (۲ هاردنینگ: سقف مهمان per-mobiel، گیت منوی پراکسی /support) → tech-lead (tsc/lint/prettier/jest/بیلد دو اپ سبز)

## لاگ رفت‌وبرگشت‌ها
- 2026-10-17 — فاز ۶:
  - بکاپ قبل از مایگریسن: `D:\AliMost\NextTest\Github\backup-pre-ticketing-2026-10-17\` (app.db + سه سایت + core.db).
  - مایگریشن 0002 تولید و **دستی بازبینی** شد: الگوی بازسازی SQLite با CTE — بک‌فیل یکتای displayId با ROW_NUMBER،
    نگاشت pending→open، استخراج lastMessage*/readAt از وضعیت قدیمی (answered→owner پشتیبان).
  - اعمال روی app.db و core.db (اسکریپت موقت با SQL خام) و هر سه سایت با `scripts/migrate-sites.ts` —
    شمار ردیف‌ها با بکاپ منطبق (۱/۰/۱/۰)؛ db push هر دو اپ «already in sync».
  - فیکس ابزار: `scripts/new-site-migration.ts` روی Node جدید ویندوز `npx.cmd` EINVAL می‌داد → فراخوانی مستقیم
    باینری محلی prisma با `process.execPath`.
  - فیکس حین دود: ردیف غایبِ boolean در getAppSettings همیشه false می‌خواند و supportEnabled (پیش‌فرض روشن)
    کار نمی‌کرد → تعمیم «غایب = DEFAULT_SETTINGS[field]» برای همه booleanها؛ لیست دستی قدیمی چهار کلید پیامک حذف شد.
- 2026-10-17 — تست دود عملیاتی (سرور 3005 با CORE_FAIL_MODE=open + کور روی 3100):
  - مهمان: POST {name,phone,body} → 201 + کوکی + TK-#####؛ GET با کوکی → تیکت خودش با unread.
  - پشتیبان: لیست ادمین با نخوانده؛ پاسخ → answered؛ بستن → پیام مهمان روی بسته ۴۰۰ فارسی؛ بازگشایی → ۲۰۱.
  - کور: تیکت مالک از پروکسی فروشگاه → در /api/tickets کور با displayId و counterpart=دامنه و unread؛
    پاسخ کور → answered؛ GET مالک markRead؛ بستن کور → پاسخ مالک روی بسته خطای فارسی.
  - ویجت: برای مهمان/مشتری در صفحه اصلی رندر می‌شود، برای پرسنل خیر.
  - ⚠️ متن فارسی ردیف‌های دود «؟؟؟» شد — تله شناخته‌شده curl ویندوز (حافظه: windows-curl-utf8)؛ باگ اپ نیست؛ ردیف‌ها حذف شدند.
- نکته جزئی باز: پراکسی فروشگاه خطای ۴۰۰ کور را با کد ۵۰۲ ولی همان پیام فارسی پاس می‌دهد (UI فقط متن را نشان می‌دهد) — قابل بهبود بعدی، بلاک‌کننده نیست.
- 2026-10-17 — فاز ۷:
  - qa: ۱۷ تست RTL جدید (SupportChatWidget ۱۳ + SupportChat ۵ با fetch mock) — جمع ۱۸ suite / ۱۲۵ تست سبز.
  - security-review (تیم زیرعامل سمت سرویس بلاک شد؛ طبق skill به‌صورت مستقیم اجرا شد): IDOR [id] ✓ (۴۰۴ یکسان)،
    کوکی mnt_support flags ✓، قفل closed هر دو مسیر ✓، markRead فقط سمت بیننده ✓، whitelist بدنه‌ها ✓،
    XSS فقط-Text ✓، timing-safe کلید کور ✓. دو یافته اصلاح شد:
    (۱) سقف مهمان per-mobiel — مهمان بدون کوکی وگرنه سهمیه نامحدود داشت؛
    (۲) پراکسی /api/admin/support/tickets گیت منوی '/support' گرفت (قبلاً requireApiUser).
  - tech-lead: tsc هر دو اپ سبز؛ eslint/prettier فایل‌های لمسی پاک (خطاهای قدیمی ریپو خارج از محدوده — مثل تسک‌های قبل)؛
    jest ۱۲۵ سبز؛ next build هر دو اپ سبز؛ بدون وابستگی/فایل پایه جدید خارج از محدوده.
  - ۸ کامیت Conventional روی feature/ticketing-process.
- 2026-10-17 — بازخورد کاربر: باگ فرم تنظیمات پشتیبانی (fix):
  - علامت‌ها: (۱) خاموش‌کردن پشتیبانی → خطای «مقدار ثانیه…»؛ (۲) ثانیه‌ها قابل مقداردهی نبودند؛
    (۳) خالی‌ها بدون خطا ذخیره می‌شدند.
  - ریشه: فرم روی useForm «uncontrolled» بود و setFieldValue دستی NumberInput به PUT نمی‌رسید
    (تا وقتی فیلد دست‌نخورده بماند مقدار اولیهٔ DB ارسال می‌شد — راز «خالی بدون خطا»)؛ و اعتبارسنجی
    API ثانیه‌ها را بی‌توجه به وضعیت پشتیبانی و با سخت‌گیری روی '' اجرا می‌کرد.
  - فیکس: فرم → الگوی state سادهٔ ReturnSettings (کنترل‌شده، رشته تا PUT)؛ API → اعتبارسنجی ثانیه
    فقط روی حالت روشن (روشنِ درخواست یا ذخیرهٔ قبلی) و خالی = پیش‌فرض مرجع ('0'/'8').
  - ۳ تست رگرسیون RTL (components/settings/SupportSettings.test.tsx) + دود زندهٔ سه سناریو روی بیلد تازه —
    جمع تست‌ها: ۱۲۸ سبز. تله: سرور قدیمی روی 3005 مانده بود (EADDRINUSE) و جواب بیلد قبل را می‌داد.

## دور بازخورد ۲ (2026-10-17 — سه مورد کاربر)
1. **باگ: کلیک روی تیکت در /customer-support گفتگو را باز نمی‌کرد** — ردیف لیست DTO
   بدون آرایهٔ messages است و TicketConversation روی live.messages.map می‌شکست.
   فیکس: هیدراتاسیون رکورد کامل با adapter.refreshTicket هنگام باز شدن گفتگو (هر دو
   مدیر فروشگاه و کور) + messages اختیاری در GenericTicket + گارد خالی.
   دود: مهمان TK-55697 ساخت → لیست ادمین → GET [id] کامل با messages → پاسخ پشتیبان → answered.
2. **پروندهٔ مشتری (پورت مرجع)** — صفحه /customers/[id] با ۷ بخش فقط-خواندنی (پروفایل/سفارش‌ها/
   کیف پول/تراکنش‌های درگاه/تیکت‌ها/کدهای تخفیف/آدرس‌ها)؛ توکن '/customers/file' در مدیریت
   نقش‌ها + ALTERNATE_GRANTS در پراکسی (پرونده با '/customers' یا توکن تنها؛ لیست با توکن
   تنها باز نمی‌شود)؛ canAccessCustomerFile؛ لینک از کارت مشتری و Context پشتیبان؛
   نقش seed «پشتیبان سایت» ['/customer-support','/customers/file'].
   دود: صفحه ۲۰۰ با همه بخش‌ها روی مشتری joghd.
3. **لاگ‌های سیستم** — دو شکاف: فیلتر نوع عملاً قفل بود (Select کنترل‌شده با onChange بی‌اثر)
   و هیچ رویداد دسترسی/سفارش ثبت نمی‌شد. SystemLog + actorName (+ایندکس kind) با
   مایگریشن 0003 داده‌محفوظ؛ دو نوع جدید access/order با logSystemEvent در: نقش‌ها
   (ایجاد/ویرایش/حذف)، گروه نقش‌ها، کاربران، مسدودی/بازنشانی گذرواژه/تعدیل کیف پول مشتری،
   fulfillment (boxing/posted/delivered/لغو+برگشت وجه)، حذف اقلام با برگشت، لغو و
   زمان‌بندی مجدد تحویل حضوری. ستون «توسط» در جدول و اکسل.
   دود: ایجاد/حذف نقش و boxing سفارش → ردیف‌های access/order با actorName درست.
- **کشف مهم گیت:** الگوی بی‌قید «logs» در .gitignore پوشه‌های سورس لاگ را از مخزن
  بیرون گذاشته بود — صفحه /logs هرگز کامیت نشده بود؛ .gitignore اصلاح (data/logs/) و
  فایل‌ها وارد مخزن شدند.

## دور بازخورد ۳ (2026-10-17 — ادامه همان دور)
- **بازخورد: «هیچ صفحه‌ای مودال نباشد + صفحه پاسخ‌گویی همه جزئیات مرجع را داشته باشد»**
  — مودال گفتگو در TicketsManager حذف شد؛ کلیک ردیف (دسکتاپ و موبایل) به صفحه
  اختصاصی می‌رود. صفحه جدید /support/[id] برای گفتگوی مالک↔کور (قبلاً فقط
  /customer-support/[id] صفحه داشت). صفحه گفتگو الان معادل مرجع است: سربرگ
  displayId+وضعیت، رشته با polling 10s، بستن/بازگشایی پشتیبان، Context
  فقط-خواندنی با لینک پرونده.
- **فیچر جدید: پیوست عکس تیکت** (درخواست کاربر): JPG/PNG، سقف ۲۰۰KB.
  - SupportTicketMessage.imagePath (مایگریشن 0004) + POST /api/support/upload
    (گارد مشتری/مهمان/پشتیبان + گیت پشتیبانی خاموش) + saveSupportImage
    (جادوی بایت‌ها؛ mime ادعاشده هرگز اعتماد نمی‌شود) + sanitize مسیر سمت سرور
    (فقط uploads/<uuid>.png|jpg — مسیر مخرب نادیده).
  - UI: پیوست/پیش‌نمایش/حذف در چت مشتری (ویجت+حساب) و صفحه پاسخ پشتیبان؛
    پیام فقط-تصویری مجاز؛ رندر عکس در حباب‌ها با باز شدن کامل در تب جدید.
  - دود: آپلود سالم→201 و سرو 200 image/png؛ ۲۵۰KB→400 فارسی؛ جعلی→400؛
    مسیر مخرب→نادیده؛ پاسخ پشتیبان→answered.
- **کشف پیش‌موجود (خارج از محدوده، ثبت برای آگاهی):** آپلودها در مسیرهای API
  به‌دلیل محدودیت ALS در activeDataDir به data/uploads اصلی می‌روند نه
  data/sites/{دامنه} — رفتار آپلودهای قدیمی هم همین است و سرو/آپلود هم‌جا
  هستند؛ اگر جداسازی per-site آپلود بخواهد، کار معماری جداگانه می‌خواهد.

## دور بازخورد ۴ (2026-10-17 — ادامه همان روز)

**بازخورد کاربر (۴ باگ):** صفحه چت پشتیبان↔مشتری باز نمی‌شود («این بخش بارگذاری نشد»)؛ گفتگوی پنل کور
هنوز مودال است؛ autorefresh ندارد؛ تیکت جدید نوتیفیکیشن نمی‌دهد.

1. **ریشه صفحه‌ی خراب — تله Mantine compound در Server Component:** `/customer-support/[id]`
   `<Grid.Col>` استفاده می‌کرد؛ در App Router، Server Component وقتی از پکیج `'use client'` کامپوننت
   می‌گیرد client reference می‌گیرد و static property (Grid.Col) روی آن `undefined` است →
   «Element type is invalid: got: undefined» → boundary «این بخش بارگذاری نشد». فیکس: import مستقیم
   `GridCol` (الگوی documentشده dashboard/page.tsx). اسکن کل ریپو: تنها همین یک فایل Server Component
   با compound مانده بود. `not-found.tsx` فارسی هم برای گروه (app) و کور اضافه شد (notFound() قبلاً
   به 404 پیش‌فرض انگلیسی می‌رفت).
2. **کور: مودال → صفحه اختصاصی:** پورت آینه‌ای `core/components/tickets/tickets-shared.ts` و
   `TicketConversation.tsx` (بدون پیوست عکس — اسکیمای کور imagePath ندارد)؛ TicketsManager کور
   لیست‌محور شد + `detailHrefBase`؛ صفحه جدید `/panel/tickets/[id]` (requireSession + getTicketFull +
   markTicketRead('core')) با polling 10s؛ فایل مرده TicketsClient.tsx حذف شد. مودال «تیکت جدید»
   ۳فیلدی طبق قاعده ≤۴ مودال ماند.
3. **autorefresh:** لیست `/support` (مالک↔کور) `features={{search, unreadOnly, autoRefreshMs: 20000}}`
   گرفت؛ بقیه از قبل داشتند (لیست پشتیبان 20s، گفتگوها 10s، ویجت مشتری 10s، لیست کور 20s).
4. **نوتیفیکیشن تیکت جدید (هر دو پنل):** تک‌منبع شمارنده‌ها `lib/bell.ts` (collectBellSnapshot از
   layout بیرون کشیده شد؛ countUnreadForStaff روی listUnreadForStaff بازسازی شد) + `GET /api/notifications`
   (badges+notifications+latest) + watcher کلاینت در DashboardShell (30s، visibility-gated): افزایش شمار
   پشتیبانی = toast «تیکت جدید» با نام درخواست‌کننده/displayId + به‌روز شدن زنده بج منو و زنگ.
   سمت کور: `GET /api/tickets/unread-count` + watcher در PanelShell با همین رفتار. بدون SSE/websocket.
5. **دود:** dev 3000 (مهمان+مشتری)، prod 3005، کور 3105/3100 — همه 200 بدون boundary؛
   unread-count JSON درست؛ tsc هر دو اپ سبز؛ jest 128/128.

**یادداشت عملیاتی:** پراکسی فروشگاه ۳۰ثانیه‌ای و pollingها سبک‌اند؛ مایگریشن 0005 در دور فیچرهای
کاتالوگ (shop-catalog-extras) اعمال شد.
