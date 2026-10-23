# وضعیت فیچر: پنل Core (SuperAdmin)

## سند راه‌حل (solution-architect)

- پشته: Node.js/Next.js (App Router) + Mantine 8 — هم‌پشته فروشگاه برای
  سازگاری UI، ولی **اپ کاملاً مستقل** در `core/` (package.json، tsconfig،
  node_modules، دیتابیس و نشست جدا) تا شرط «deploy/publish مستقل» برآورده شود.
- موتور دیتابیس: SQLite فایل‌محور `core/data/core.db` (هم‌رویِ فروشگاه؛
  مهاجرت به PostgreSQL بعداً فقط با تعویض datasource ممکن است).
- پورت: 3100 در dev و start. کوکی `core_session`، SECRET جدا (`CORE_AUTH_SECRET`).
- پالت برند از لوگوها (d:\Pictures\AlazCore): midnight #1B2A34، flame #FB7401،
  crimson #7C000C. لاگین Core عمداً متفاوت از لاگین فروشگاه: تمام‌صفحه تیره
  با لوگوی کامل، بدون کارت روشن وسط‌چین.

## وضعیت مراحل

- [x] اسکلت core/ + prisma جدا + seed (کاربران، تم‌های پایه، پلن نمونه، joghd.ir)
- [x] lib: db/session/auth/licensing/catalog/format + تم برند
- [x] احراز هویت + proxy پنل + صفحه ورود متمایز
- [x] شل پنل (RTL، سایدبار، هدر شعله‌ای) + داشبورد آماری با هشدار اعتبار
- [x] مدیریت دامین‌ها (CRUD، مالک/رابط فنی، پلن+انقضا، تم، تعلیق، مودال
      درگاه‌های ipg/bnpl و پنل‌های پیامکی per-domain)
- [x] مدیریت پلن‌ها (منوهای قابل‌واگذاری هم‌نام ASSIGNABLE_MENUS فروشگاه، سقف
      محصولات، مدت اعتبار، فعال/غیرفعال)
- [x] مدیریت تم‌ها (فعال/غیرفعال، پیش‌فرض یکتا، تعریف تم custom)
- [x] تیکتینگ (فهرست+فیلتر وضعیت، گفتگو، پاسخ پشتیبان، تغییر وضعیت)
- [x] کاربران Core (superadmin/support، گارد خودحذفی) + تنظیمات (کلید API)
- [x] API اعتبارسنجی POST/GET /api/validate (x-core-key، snapshot کامل)
- [x] اتصال فروشگاه: lib/core-license.ts (کش ۵دقیقه، fail-open)، چک لایسنس در
      proxy.ts → /site-inactive، فیلتر منو در (app)/layout.tsx + NavLinks
      (admin-only با مجوز صریح پلن هم دیده می‌شود)، /panel روی فروشگاه → /dashboard
- [x] رفع خطاهای typecheck فروشگاه (RoleGroup model + lib/roles.ts)
- [x] بیلد و تست: هر دو اپ typecheck صفر؛ core بیلد شد و کل جریان ورود
      (login→/panel→domains) با curl تأیید شد (200)

## مشکلات گزارش‌شده و اصلاح

- 500 روی /panel (MantineProvider نبود در layout) → Providers اضافه شد.
- seed: فیلد label در GatewayBinding جا افتاده بود → اسکیما اصلاح شد.
- 404 بعد از لاگین (کاربر) → دو علت پوشش داده شد: صفحه ورود جدید (بیلد مجدد
  لازم) + ریدایرکت /panel فروشگاه به /dashboard. curl تست شد.
- صفحه ورود Core مثل فروشگاه بود → بازطراحی تمام‌صفحه تیره برند.

## دور دوم — تکمیل بندهای باقی‌مانده (2026-09-23)

- [x] فیلتر درگاه‌های پرداخت طبق Core (بند ۲-۸): در سه مسیر پرداخت
      (orders/[id]/checkout، pay/[token]، wallet/charge) لیست درگاه‌ها با
      licensedGatewayIds() اشتراک می‌شود؛ درگاه پیش‌فرض غیرمجاز = اولین مجاز.
- [x] فیلتر پنل پیامکی طبق Core: sendViaPanel در order-sms.ts — پنل فعال فقط
      اگر مجاز باشد؛ وگرنه اولین پنل مجازِ پیکربندی‌شده؛ هیچ‌کدام نبود =
      ثبت لاگ و رد بی‌خطر.
- [x] اعمال تم Core (بند ۲-۹): getActiveThemeId اول licensedThemeKey() را
      می‌پرسد؛ تم ناشناخته (custom) به انتخاب داخلی برمی‌گردد.
- [x] سقف محصولات پلن: POST /api/products با licensedProductLimit() تعداد فعلی
      را چک می‌کند؛ پر بودن = 403 با پیام ارتقای پلن.
- [x] تیکتینگ مالک↔سوپرادمین روی همان سیستم تیکت Core:
  - سمت Core: /api/tenant/tickets (+[id]) با احراز x-core-key+x-core-domain؛
    دامنه باید ok باشد؛ پیام tenant با authorSide 'tenant'، پاسخ → pending.
  - سمت فروشگاه: lib/support-tickets.ts (کلاینت core) + پراکسی احرازشده
    /api/admin/support/tickets(+[id]) + صفحه /support با گفتگو و آیتم منو.
  - /support همیشه در coreAllowedHrefs هست (پشتیبانی حق مشترک دامنه‌های فعال).
- [x] تست E2E با curl: create → reply → list (۲ تیکت، وضعیت pending)؛
      کلید غلط 401؛ دامنه نامعلوم 403؛ پنل Core همان تیکت‌ها را می‌بیند (200).

## نکته‌های باقی‌مانده (پیشنهاد مرحله بعد)

- UI انتخاب درگاه در checkout/pay فقط درگاه‌های مجاز را نمایش دهد (فعلاً
  سمت سرور فیلتر می‌شود؛ انتخاب نامجاز 400 می‌گیرد).
- اعلان/شمارنده تیکت باز در هدر پنل فروشگاه.
- صفحه وضعیت لایسنس در پنل فروشگاه (نمایش پلن/انقضا/منوها برای مالک).

## دور سوم — معماری B2B2C و کامپوننت مشترک (2026-09-26)

شفاف‌سازی مدل: AlazCore (B) به مالکان فروشگاه (B) خدمت می‌دهد و هر فروشگاه
مشتریان خودش (C) را دارد. دو ساید:
- panel (اپ core، پرسنل آلازکور): دامین/پلن/تم + پشتیبانی مالک↔آلازکور +
  کاربران آلازکور.
- dashboard (اپ فروشگاه، مالک): امکانات موجود + پشتیبانی مشتری↔مالک +
  پشتیبانی مالک↔آلازکور + کاربران/پرسنل فروشگاه.

- [x] کامپوننت ژنریک components/tickets/TicketsManager.tsx (props: tickets,
      adapter, role) — یک نسخه کپی در core/components (اپ‌ها مستقل‌اند).
  - ساید panel: core/panel/tickets با CoreTicketsClient (viewerSide core،
    مدیریت وضعیت، ستون دامنه).
  - ساید dashboard: /(app)/support مالک↔آلازکور (adapter پراکسی Core،
    viewerSide tenant) و /(app)/customer-support مشتری↔مالک (viewerSide owner،
    ایجاد ندارند، وضعیت را مالک می‌چرخاند).
  - ساید مشتری: /account/support (viewerSide customer، ایجاد+پاسخ+بستن).
- [x] مدل‌های فروشگاه: SupportTicket + SupportTicketMessage (همان شمای وضعیت
      تیکت Core) + db push.
- [x] APIها: /api/account/support/tickets(+[id]) مشتری؛ /api/admin/tickets(+[id])
      مالک (requireApiMenu /customer-support که به ASSIGNABLE_MENUS هم اضافه شد)؛
      پراکسی‌های Core قبلی سر جایشان.
- [x] منوها: پشتیبانی مشتریان در nav داشبورد + پشتیبانی فروشگاه در AccountNav.
- [x] تست دود: بیلد هر دو اپ؛ جریان مشتری(ایجاد)→مالک(پاسخ)→وضعیت answered با
      counterpart صحیح؛ صفحات /customer-support و /support هر دو 200.
- مدیریت کاربران دو ساید از قبل مستقل است (panel/users برای آلازکور،
  dashboard /users+/roles برای فروشگاه) — همان جدایی B2B2C.

## دور چهارم — سند راه‌حل (solution-architect، 2026-09-26)

**مسئله**: سه اصلاح کاربر: (۱) تیکت باید مثل چت دوطرفه باشد — قفل «نوبت کیست»
غلط است و حذف می‌شود؛ ارسال پیام روی تیکت بسته هم باید بازگشایی کند.
(۲) «پشتیبانی Core» در داشبورد مالک از سایدبار به منوی پروفایل (UserMenu)
منتقل شود با عنوان «ارتباط با پشتیبانی». (۳) مدیریت کاربران پنل Core باید
هم‌سان پنل فروشگاه باشد — از جمله تعریف نقش‌ها (Role) که الان در Core نیست.

**پشته فنی**: Node.js/Next.js (هر دو اپ shop و core) + Mantine UI؛ دیتابیس
SQLite (data/app.db فروشگاه، core/data/core.db) — تطابق با پروژه موجود.

**راه‌حل پیشنهادی**:
- کامپوننت TicketsManager: حذف قفل نوبت؛ دکمه «بازگشایی تیکت» برای
  canManageStatus روی تیکت بسته؛ منطق وضعیت بعد از پیام به helper خالص
  nextTicketStatus(side, previous) منتقل و در همه APIها یکسان مصرف شود.
- منوی پروفایل: حذف /support از nav-items سایدبار؛ افزودن آیتم
  «ارتباط با پشتیبانی» به UserMenu هدر داشبورد.
- Core: مدل CoreRole (name/title/isAdmin/permissions) + CoreUser.role → نام
  ماشین نقش؛ perms در سشن Core؛ کاتالوگ منوهای پنل Core
  (core/lib/nav-permissions.ts)؛ گیت در proxy و شل؛ APIهای CRUD نقش/کاربر
  هم‌سان lib/roles.ts فروشگاه؛ صفحه /panel/roles + Select نقش در فرم کاربران.

**مدل‌های تحت تاثیر**: core.db: CoreRole (جدید)، CoreUser (بدون تغییر ساختار —
معنای role تغییر می‌کند به نام ماشین نقش؛ seed نقش‌ها را می‌سازد). shop.db:
بدون تغییر (SupportTicket موجود).

**لایه‌های درگیر**: db-architect (CoreRole)، nodejs-developer (APIها و
libها هر دو اپ)، nextjs-frontend-developer (TicketsManager، UserMenu، شل و
صفحات Core)، qa-tester (تست helper وضعیت + رگرسیون typecheck).

**Edge Caseها**:
1. پاسخ به تیکت بسته → بازگشایی خودکار (status بر اساس سمت فرستنده).
2. کاربر Core با نقش سفارشی بدون مجوز /panel/users → API و منو هر دو ببندند.
3. حذف نقش‌ای که کاربر Core دارد → ممنوع (همان قاعده فروشگاه).
4. نقش سیستمی superadmin → غیرقابل حذف/پایین‌آوردن isAdmin.
5. session قدیمی بدون perms → superadmin باز هم '*' بگیرد (سازگاری).

**ریسک‌ها**: مجوزدهی (IDOR در تیکت‌ها از قبل بسته است — دامنه/مالک چک
می‌شود)؛ گیت منوهای Core باید در API و UI هم‌زمان اعمال شود؛ مهاجرت
معنایی ستون role در CoreUser با seed idempotent.

**معیار پذیرش**:
- هر دو طرف هر تیکت بسته هم بتوانند پیام بفرستند و ارسال، تیکت را بازگشایی کند.
- پشتیبان (canManageStatus) دکمه بازگشایی صریح دارد.
- «ارتباط با پشتیبانی» فقط در منوی پروفایل داشبورد است، نه سایدبار.
- در پنل Core نقش تعریف/ویرایش/حذف می‌شود و کاربر جدید نقش می‌گیرد؛ کاربر
  با نقش سفارشی فقط منوهای واگذارشده را می‌بیند.

## دور چهارم — پیاده‌سازی و QA (2026-09-26)

- [x] db-architect: مدل CoreRole (جدید، غیرمخرب) + رابطه به CoreUser.role با
      onDelete: Restrict؛ db push + seed نقش‌های سیستمی superadmin/support.
- [x] nodejs: کاتالوگ core/lib/nav-permissions.ts، سشن Core با perms،
      resolveCoreRole/requireApiMenu/requireApiAdmin هم‌سان فروشگاه؛ همه
      APIهای core دوباره گیت شدند (domains/plans/templates → menu grants،
      users/settings → admin)؛ lib/core-roles.ts + API /api/roles(+[id])؛
      users API نقش را از جدول نقش‌ها اعتبارسنجی و قفل خودِ ادمین با isAdmin.
- [x] frontend: PanelShell با فیلتر perms + آیتم نقش‌ها؛ صفحه /panel/roles
      (چک‌باکس view/edit/add از کاتالوگ، نقش سیستمی فقط عنوان)؛ UsersClient
      با Select نقش از سرور.
- [x] تیکت چت دوطرفه: قفل «نوبت کیست» حذف شد از TicketsManager (هر دو کپی)؛
      دکمه «بازگشایی تیکت» برای canManageStatus؛ ارسال روی بسته = بازگشایی
      خودکار. helper خالص lib/ticket-flow.ts (nextTicketStatus) در هر ۴ API
      (account، admin، core، tenant) یکسان مصرف شد — 'open' صریح هم پشتیبان.
- [x] «پشتیبانی Core» از سایدبار حذف و در UserMenu با عنوان
      «ارتباط با پشتیبانی» نشست.
- [x] qa-tester: jest lib/ticket-flow.test.ts — ۷ تست، همه سبز (شامل
      بازگشایی خودکار closed و سمت ناشناخته). typecheck هر دو اپ صفر؛
      بیلد هر دو اپ موفق.
- [x] دود E2E: ساخت نقش سفارشی billing در Core؛ بستن تیکت → پاسخ مالک
      بازگشایی به pending؛ بازگشایی صریح با status open؛ سمت فروشگاه هم
      close → پاسخ مشتری → pending. صفحات /panel/roles، /customer-support،
      /support همه 200.

## باقی‌مانده (پیشنهاد بعدی)

- شمارنده تیکت باز در هدر هر دو پنل + صفحه وضعیت لایسنس برای مالک.
- تست E2E مرورگری (Playwright) برای چت دوطرفه.

## دور پنجم — Multi-tenant DB + رفع تست localhost (2026-09-26)

**تصمیم کاربر**: multi-tenancy داینامیک (یک اپ، هر درخواست به دیتابیس دامنه
خودش)؛ دیتابیس جدید = خالی + ادمین (بدون داده دمو).

**راه‌حل**:
- رفع باگ دامنه: اولویت با SHOP_DOMAIN (knab توسعه‌دهنده) بعد هدر Host؛
  localhost/127.0.0.1 بدون SHOP_DOMAIN → bypass اعتبارسنجی + دیتابیس اصلی.
- کانتکست سایت: AsyncLocalStorage در lib/site-context.ts؛ نقطه ورود
  ensureSiteContext() در getSession/requireSession (همه APIها/صفحات authed)
  + صفحات/API عمومی؛ proxy.ts هدر x-site-domain هم تزریق می‌کند.
- lib/db.ts → Proxy روی PrismaClient: اگر کانتکست سایت هست، model delegate
  کلاینت همان سایت (کش per-domain)؛ وگرنه دیتابیس اصلی.
- lib/site-db.ts: data/sites/{sanitized}/{sanitized}.db + ensure (mkdir،
  prisma db push با --url مطلق، bootstrap ادمین پیش‌فرض اگر خالی، marker)؛
  Next 16 Proxy روی Node runtime است پس ALS در پروسه shared است.
- Core: ستون‌های Domain.dbName/dbStatus + provisioning هنگام ثبت دامین
  (mkdir + db push با schema فروشگاه از SHOP_APP_ROOT) + نمایش نام دیتابیس
  در مدیریت دامین‌ها. نام DB هنگام ساخت ثابت می‌ماند (rename دامین DB را
  جابه‌جا نمی‌کند).

**معیار پذیرش**: SHOP_DOMAIN=joghd.ir → اعتبارسنجی+دیتای joghd؛ SHOP_DOMAIN
سایت دوم → دیتای خالی همان؛ localhost بدون override → سایت باز با دیتابیس
اصلی؛ ثبت دامین جدید در Core → پوشه/دیتابیس ساخته و نامش در جدول دیده شود.

**نتایج دور پنجم (QA)**:
- بیلد هر دو اپ سبز؛ ۳۳/۳۳ تست jest فروشگاه سبز.
- رفع خطای بیلد کلاینت: ثابت‌های نمایشی به ماژول‌های کلاینت‌سِیف منتقل شد
  (lib/meta-tag-defs.ts، lib/payment-defs.ts، order-status مستقیم،
  DEMO_CREDENTIALS → lib/constants) — اسکریپت پایش
  scripts/find-client-server-imports.py.
- provision از `prisma db push --url` (پشتیبانی نمی‌شود) به اجرای DDL
  آرتیفکت prisma/site-schema.sql با $executeRawUnsafe تغییر کرد.
- دود: ثبت shop2.ir در Core → data/sites/shop2.ir/shop2.ir.db ساخته شد و
  ستون «دیتابیس» ready؛ SHOP_DOMAIN=shop2.ir → سایت 200 + لاگین ادمینِ همان
  دیتابیس (1 کاربر bootstrap) + dashboard 200؛ SHOP_DOMAIN=joghd.ir →
  data/sites/joghd.ir/joghd.ir.db ساخته شد؛ localhost بدون override → 200 با
  دیتابیس اصلی (13 سفارش دمو) و بدون خطای دامنه.

## دور ششم — رفع باگ ایزولاسیون + گزارشات/پورسانت (2026-09-27)

**باگ کاربر**: با SHOP_DOMAIN=shop2.ir تم عوض می‌شد ولی دیتا از فروشگاه اول
می‌آمد. دو ریشه:
1) ALS در module-scope هر باندل Next کپی جدا داشت → کانتکست در یک کپی،
   Proxy دیتابیس از کپی دیگر null می‌خواند. اصلاح: ALS روی globalThis
   (lib/site-runtime.ts) — تک‌نمونه بین همه باندل‌ها.
2) enterWith داخل تابع async روی continuation معلق caller اثر پایدار ندارد
   → کانتکست بعد از اولین await می‌ریخت. اصلاح معماری lib/db.ts: هر دسترسی
   prisma کلاینت فعال را خودش resolve می‌کند (fast path sync از ALS، cold
   path با dedupe globalThis) + Proxy دو سطحی (مدل→متد) برای
   prisma.user.findUnique و $-متدها.

**همچنین**:
- bootstrap ادمین دامنه‌ای admin@{دامنه} (idempotent؛ سایت‌های قبلی هم پوشش).
- آپلودها/سرو فایل‌ها per-site: data/sites/{دامنه}/uploads (files + upload).
- Core: Domain.commissionPercent (۰-۱۰۰) + فیلد/ستون در مدیریت دامین‌ها +
  seed ۱۰٪ برای joghd.ir + retry-provision برای دامنه‌های قبل از این فیچر.
- منوی «گزارشات» /panel/reports (مدیر سامانه؛ قابل واگذاری): محصولات هر
  سایت، فروش هر کالا (itemsJson)، فروش ماهانه (برچسب شمسی)، درآمد آلازکور =
  درصد × فروش (فروش = به‌جز pending/cancelled).

**QA**: بیلد هر دو اپ سبز؛ ۳۳/۳۳ تست سبز؛ دود پروداکشن: لاگین
admin@shop2.ir OK، محصولات shop2 = [] در حالی که main = ۸ محصول (ایزوله)؛
home 200؛ reports 200؛ joghd.ir پس از retry → دیتابیس ساخته شد.

## دور هفتم — گزارشات مستقل، کاتالوگ‌ها، اعمال کاتالوگ در فروشگاه (2026-09-27)

- [x] کرش داشبورد روی سایت خالی: RevenueChart/Sparkline/CategoryBars با
      Math.max([]) می‌مردند — گارد داده خالی + حالت «هنوز داده‌ای نیست»
      (hooks بدون شرط، فقط رندر شرطی).
- [x] کاتالوگ‌های مرکزی: مدل CoreGateway (ipg/bnpl) + CoreSmsPanel + رابطه
      Restrict با بایندها؛ seed کاتالوگ کامل؛ صفحات /panel/gateways،
      /panel/bnpl، /panel/sms-panels با سوییچ فعال/غیرفعال؛ API
      /api/catalog/*.
- [x] قاعده کاتالوگ غیرفعال: فقط از «تخصیص جدید» حذف می‌شود؛ تخصیص‌های
      موجود سر جایشان (لیسنس همچنان برمی‌گرداند) و در صفحه تخصیص بخش جدا
      «تخصیص‌های قدیمی (کاتالوگ غیرفعال)» با امکان لغو دیده می‌شوند.
- [x] صفحه تخصیص tabular جای مودال: /panel/domains/[id]/integrations با
      checkboxها + دکمه «ذخیره تغییرات» (diff → upsert/delete)؛ لینک از
      جدول دامین‌ها (آیکن کارت) به‌جای مودال.
- [x] ناوبری گروهی PanelShell: فروشگاه‌ها، درگاه و پیامک، گزارشات (۴
      زیرمنو)، تیکت‌ها، مدیریت کاربران (کاربران/نقش‌ها)، تنظیمات — با
      فیلتر perms روی گروه/فرزندان؛ کاتالوگ CORE_MENUS هم‌گروه شد.
- [x] گزارشات مستقل با فیلتر: /panel/reports/{products,product-sales,
      monthly-sales,revenue} — فیلترهای دامنه، از/تا تاریخ (createdAt)،
      گروه کالا (productId↔دسته در دیتابیس سایت) و نام کالا؛ ReportFilterBar
      مشترک (query params → رندر سمت سرور)؛ /panel/reports → ریدایرکت.
      درآمد = commissionPercent × فروش فیلترشده.
- [x] اعمال کاتالوگ Core در داشبورد فروشگاه: getLicensedCatalog() —
      payment/bnpl/sms/theme صفحات تنظیمات فقط آیتم‌های مجاز را نشان می‌دهند
      (تم = فقط تم تعیین‌شده Core)؛ بدون Core مثل قبل.
- [x] QA: typecheck صفر؛ بیلد هر دو اپ سبز؛ ۳۳/۳۳ تست؛ دود پروداکشن:
      ۴ صفحه گزارش ۲۰۰، integrations ۲۰۰، toggle کاتالوگ OK، داشبورد روی
      سایت خالی ۲۰۰، تنظیمات ۲۰۰. نکته: dev سرور flaky بود (حتی login
      500 می‌داد) — ارزیابی روی بیلد پروداکشن.

## دور هشتم — سند رسمی گزارشات + گزارشات مالی مالک (2026-09-28)

- [x] سند رسمی (هر دو اپ): کامپوننت ReportDocument — سربرگ سند (عنوان، برند
      AlazCore، تاریخ شمسی سند، خلاصه فیلترهای اعمال‌شده)، گرید با border
      کامل + هدر تیره برند + zebra + ردیف جمع (tfoot)، دکمه «چاپ» با CSS
      چاپ (حذف شل/فیلترها، A4 landscape) و دکمه «خروجی اکسل».
- [x] اکسل: core → exceljs + lib/report-export.ts + API /api/reports/[kind]/
      export (محصولات/فروش هر کالا/ماهانه/درآمد — فیلترها در query، ردیف
      متادیتای سند در شیت). فروشگاه → lib/owner-report-export.ts + همین API
      با گارد requireApiMenu هر گزارش.
- [x] فروشگاه — منوی مالی داشبورد مالک: چهار گزارش زیر گروه مالی
      (/reports/{products,product-sales,monthly-sales,revenue}) روی
      دیتابیس همین سایت (lib/reports.ts، بدون فیلتر دامنه)؛ قابل واگذاری در
      نقش‌ها (ASSIGNABLE_MENUS مالی). commissionPercent از payload لایسنس
      خوانده می‌شود (به CoreLicense اضافه شد).
- [x] باگ مهم کشف‌شده: compoundهای Mantine Table (Table.Tr/Thead/…) در
      صفحات **سروریِ** فروشگاه undefined برمی‌گردند ( optimizePackageImports؛
      جدول‌های قبلی فروشگاه همگی کلاینت بودند) — حتی به‌صورت children به
      کامپوننت کلاینت. قاعده جدید پروژه: در صفحات سروری از <table> خام با
      CSS ماژول استفاده شود (ReportDocument با جدول خام بازنویسی شد).
      Core صفحات سروری با Table compound دارد و در بیلد core سالم است.
- [x] QA: بیلد هر دو اپ سبز؛ ۳۳/۳۳ تست؛ دود پروداکشن joghd.ir:
      ۴ صفحه گزارش مالک ۲۰۰ + اکسپورت xlsx 200 (فایل معتبر) + داشبورد ۲۰۰؛
      صفحات گزارش Core هم ۲۰۰ (بیلد قبلی).

## دور نهم — رفع باگ‌های گزارش کاربر (2026-09-28)

- [x] خطای کاذب «ذخیره محصول انجام نشد» (ذخیره موفق ولی خطا): $transaction
      آرایه‌ای پرایسما برند promise خودش را چک می‌کند؛ Proxy قبلی promise
      زنجیره‌ای بی‌برند می‌داد. اصلاح lib/db.ts: fast path sync — وقتی
      کانتکست سایت روی ALS است، خروجی همان **promise واقعی پرایسما** است.
      تست: POST /api/products → 201 و صفر خطای «All elements…».
- [x] فیلتر داشبورد مالک (سناریوی کاربر: ۹ درگاه → غیرفعال‌سازی → ۶ فعال
      در کاتالوگ → تخصیص ۲ مورد → مالک فقط ۲ را می‌بیند): دو ریشه رفع شد:
  1) getLicensedCatalog شرطش «داشتن پلن» بود — سایت بدون پلن (مثل shop2)
     fail-open می‌شد و لیست کامل می‌دید. شرط → فقط ok بودن لایسنس.
  2) PaymentSettings/BnplSettings لیست credential را از GATEWAY_SECTIONS
     هاردکد داخلی رندر می‌کردند نه prop فیلترشده — فیلتر sections با
     allowedIpg/allowedBnpl اعمال شد. تست: shop2 (تخصیص: دیجی‌پی/ملت/
     پاسارگاد + فراز‌اس‌ام‌اس) → صفحه درگاه فقط همان ۳، sms فقط فراز
     (بقیه صرفاً در متن توضیحی بودند)، bnpl خالی، تم فقط تم Core.
- [x] loading.tsx برای سگمنت‌های هر دو اپ (app، (app)، account، core panel)
      + error.tsx با «تلاش مجدد» — خطای ناوبری دیگر «This page couldn't
      load» خام نیست.
- [x] خطای گزارشات Core کاربر: محتمل‌ترین علت build کهنه اپ core (صفحات
      گزارش بعد از آخرین build او اضافه شدند)؛ با error.tsx هم بازیابی‌پذیر
      شد. دود: ۴ صفحه مستقیم ۲۰۰ + prefetch RSC سالم.

## دور دهم — قاعده «در حال استفاده» + ویرایش نام/لوگوی کاتالوگ (2026-09-28)

- [x] قاعده حذف تخصیص: کارشناس Core نمی‌تواند درگاه/پنلِ «در حال استفاده» را
      از تخصیص دامنه حذف کند؛ بقیه آزادند. «استفاده» = تنظیمات وارد‌شده
      (AppConfig با پیشوند شناسه درگاه، مقدار غیرخالی) یا تراکنش ثبت‌شده
      (OnlinePaymentTransaction.gateway) در دیتابیس همان سایت — خواندن با
      raw SQL (کلاینت Core این مدل‌ها را ندارد؛ delegate خطا نباید بی‌صدا
      «عدم استفاده» تفسیر شود) و «نمی‌دانم» هم حذف‌نکردن (fail-safe).
      تست: mellat با تنظیمات شبیه‌سازی‌شده → 409 با پیام فارسی؛ snapppay
      بدون تنظیمات → 200. صفحه تخصیص، حذف‌های ردشده را در اعلان جدا گزارش
      می‌کند و بقیه را اعمال.
- [x] ویرایش نام + آپلود لوگو برای کاتالوگ‌ها (درگاه/اقساط/پیامکی):
      CoreGateway/CoreSmsPanel.logoPath + PATCH چندحالته (JSON=isActive،
      FormData=label+logo با اعتبارسنجی magic bytes و سقف ۲MB) + سرو عمومی
      /api/catalog/logo/[kind]/[id] + مودال ویرایش و ستون لوگو در
      CatalogManager. تست: rename mellat + آپلود png → 200 و سرو 200.

## دور یازدهم — API کاتالوگ مالک + merge با کانفیگ محلی (2026-09-28)

- [x] درخواست کاربر: «یه API باشه که درگاه‌های تخصیص‌داده‌شده را لیست کنه و
      درگاهِ در-حال-استفاده که کانفیگش در دیتابیس خودشه از همانجا خوانده
      شود» → GET /api/admin/settings/assigned + lib/owner-catalog.ts:
      کاتالوگ مالک = union(تخصیص‌های Core از لایسنس، موارد کانفیگ‌شده محلی
      از AppConfig دیتابیس خود سایت) — موارد کانفیگ‌شده هرگز با تغییر
      تخصیص حذف نمی‌شوند؛ Core غایب و بدون کانفیگ محلی = بدون محدودیت.
- [x] صفحات تنظیمات payment/bnpl/sms/theme همه از getOwnerAllowedCatalog
      مصرف می‌کنند (قبلاً getLicensedCatalog بدون merge محلی بود).
- [x] تست (shop2، تخصیص فعلی دیجی‌پی/ملت/پاسارگاد/سمان + فراز‌اس‌ام‌اس):
      API → ipg=[mellat,pasargad,saman]+digipay پس از رفرش کش، صفحه درگاه
      فقط تخصیص‌یافته‌ها (آی‌دی‌پی/وایب مخفی)، unassigned هرگز.

## دور دوازدهم — سایدبار مالک + ری‌دیزاین Core (design-system) (2026-09-28)

- [x] سایدبار داشبورد مالک بازنویسی شد با زبان بصری سایدبار Core: Mantine
      NavLink (variant light / color brand)، گروه‌های تاشو با زیرمنوی تورفته
      (جعبه محو)، حالت فعال pill برند، badge در rightSection — منطق مجوز
      قبلی (perms + admin-only با مجوز صریح Core) دست‌نخورده. CSS module به
      جعبه زیرمنو محدود شد. تست: dashboard 200 با markup NavLink.
- [x] ری‌دیزاین Core طبق skill design-system (ساختار Coinbase، برند خودمان):
      PageHeader مشترک (عنوان ۸۰۰ + توضیح کم‌رنگ + جایگاه اکشن) در
      CatalogManager؛ pill CTA (radius xl) فقط روی دکمه اصلی صفحه‌ها
      (تعریف دامنه/پلن/تم/کاربر، ثبت تیکت)؛ footer سایدبار به چیپ سطح‌بندی
      شده (عمق با بوردر نه سایه)؛ بوردر نوار کنار با tier تم. رنگ/فونت
      Coinbase ممنوع — همه از توکن‌های Mantine.
- [x] بیلد هر دو اپ سبز؛ ۳۳/۳۳ تست؛ دود: dashboard/gateways 200 با markup
      جدید.

## دور سیزدهم — موجودی هوشمند: نقطه سفارش / رو به اتمام / خالی‌فروشی (2026-09-28)

- [x] Product.reorderPoint/minStock + Order.oversell/oversellQty (shop)؛
      Domain.oversellAllowed/oversellMax (core) + فرم دامنه (سوییچ + سقف عدد)
      + API + payload لایسنس oversell.
- [x] اعمال خالی‌فروشی در placeOrder: کسری موجودی فقط با اجازه Core و ظرفیت
      سقف کل فروشگاه (SUM(-qty) برای منفی‌ها)؛ خط کسری بدون شرط gte کاهش
      می‌یابد (موجودی منفی) و سفارش oversell/oversellQty ثبت می‌کند؛ بدون
      اجازه → خطای فارسی. درگاه‌دسته‌ای race حفظ شد.
- [x] lib/stock.ts + صفحه «لیست خرید» و «رو به اتمام» زیر منوی کالا (نقش‌های
      قابل واگذاری) + سه باکس داشبورد (نقطه سفارش/رو به اتمام/خالی‌فروشی با
      لینک) + نوتیفیکیشن مدیر در ورود به داشبورد + فیلتر «خالی‌فروشی» در
      سفارشات (select + listOrders oversell param).
- [x] گرافیک Core طبق بازخورد کاربر (رنگ‌ها نامناسب): تم پیش‌فرض light —
      هدر سفید سنده‌ای با لوگو/مرز، بنر شعله‌ای حذف، canvas خاکستری روشن،
      برند فقط کارکردی. dark همچنان با سوییچ موجود.
- [x] دو باگ زیربنایی: (۱) بیلد/m Build worker به دیتابیس سایت قدیمی وصل
      می‌شد → گارد NEXT_PHASE در ensureSiteContext (build = main db)؛
      (۲) دیتابیس‌های سایتِ قبلی ستون‌های جدید نداشتند → مهاجرت سبک خودکار
      ستون‌ها در ensureSiteDb + تولید مجدد prisma/site-schema.sql.
      sitemap prerender که به همین علت می‌شکست → 200.
- [x] QA: بیلد هر دو اپ سبز؛ ۳۳/۳۳ تست؛ دود: دو صفحه جدید ۲۰۰، داشبورد ۲۰۰،
      orders?oversell=yes ۲۰۰، sitemap ۲۰۰، oversell در payload لایسنس
      {allowed:true,max:10} برای joghd (تنظیم از فرم دامنه).

## دور چهاردهم — رفع صفحه‌های خراب + خالی‌فروشی محصول (2026-09-28)

- [x] صفحه‌های «از کار افتاده» (users/roles/categories/customer-support/
      مالی جز تخفیف/meta/shahkar/security/shipping/logs/reports): علت —
      گیت منوهای پلن Core حتی ادمین سایت را محدود می‌کرد و shop2 پلن «پایه»
      داشت. اصلاح: محدودیت پلن فقط برای پرسنل؛ مالک (admin) پنل کامل.
      تست: همه ۱۶ صفحه ۲۰۰ برای مالک.
- [x] فرم محصول: نقطه سفارش/حداقل موجودی/خالی‌فروشی کالا (سوییچ + سقف
      ۱..حد دامنه) — فقط وقتی Core خالی‌فروشی را مجاز کرده نمایش داده
      می‌شود؛ ProductDTO/Input/create/update + API + صفحات new/edit.
- [x] اعمال per-product: خط کسری فقط برای کالای با oversellAllowed و
      ظرفیت سقفِ کالا (+ سقف کل دامنه)؛ مهاجرت ستون‌های Product در
      site-db و site-schema.sql تولید مجدد. create=201 با فیلدهای جدید.
