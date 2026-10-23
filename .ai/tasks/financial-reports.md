# گزارشات مالی بک‌آفیس فروشگاه + گیت لایسنس

> واژه‌شناسی مصوب کاربر (2026-10-04): پنل/سرور AlazCore = **بک‌آفیس کور**؛ داشبورد مالک فروشگاه = **بک‌آفیس فروشگاه**.

## درخواست کاربر (2026-10-04)

1. سؤال لایسنس: «وقتی وبسایت فروشگاه لود می‌شود باید به بک‌آفیس کور درخواست اعتبارسنجی بزند و بعد صفحه لود شود؛ وگرنه خطای سرویس در دسترس نیست.»
2. منوی مالی: گزارش‌های مالی داخل منوی «مالی» مردود؛ منوی مستقل «گزارشات مالی» ساخته شود، گزارش‌های فعلی حذف شوند، و بر اساس best-practice حداکثر ۷ گزارش پیشنهاد شود تا کاربر انتخاب کند.

## آنچه انجام شد

### گیت لایسنس (fail-closed)
- `lib/core-license.ts`: پیش‌فرض `CORE_FAIL_MODE` از `open` → `closed` (قرارداد محصول: لود صفحه فقط بعد از تأیید Core). `serviceDown?: true` روی پاسخ سنتزی برای تمایز «سرویس قطع» از «دامنه ثبت‌نشده». کش منفی ۱۵ ثانیه برای پاسخ ناموفق (هر لود صفحه ۴ ثانیه منتظر تایم‌اوت نمی‌ماند).
- `.env`: `CORE_FAIL_MODE=closed`.
- `proxy.ts`: `/site-inactive` به `PUBLIC_PATHS` اضافه شد — بدون این، بازدیدکنندهٔ لاگ‌اوت با Core قطع در لوپ ریدایرکت login↔site-inactive می‌افتاد (باگ واقعی که فقط در حالت fail-cرد دیده می‌شد).
- `app/site-inactive/page.tsx`: حالت `serviceDown` پیام «سرویس موقتاً در دسترس نیست» نشان می‌دهد، نه «دامنه ثبت‌نشده».

**تست واقعی:** با Core قطع (CORE_API_URL نادرست): `/shop` → 307 به `/site-inactive` با پیام درست. با Core سالم: `/shop` → 200.

**یافته مهم برای کاربر:** سرور dev بک‌آفیس کورِ در حال اجرا (پورت ۳۱۰۰) جدول مسیرهایش قدیمی است و `/api/validate` را 404 می‌دهد — کد موجود است (کامیت 48110ac) و روی نمونه production تست شد (200 + ok:true). تا ری‌استارت این سرور dev، اعتبارسنجی هیچ‌وقت موفق نمی‌شود و با fail-closed سایت‌ها روی «سرویس در دسترس نیست» می‌مانند.

### منوی گزارشات مالی
- حذف شد: ۴ صفحه `app/(app)/reports/{products,product-sales,monthly-sales,revenue}`، `app/api/reports/[kind]/export`، `components/reports/OwnerReportFilterBar`.
- `lib/reports.ts` و `app/api/core/reports/[kind]` **حذف نشدند** — بک‌آفیس کور (`core/lib/site-queries.ts`) از همان API می‌خواند.
- `components/layout/nav-items.ts` + `lib/nav-permissions.ts`: گروه جدید `financial-reports` («گزارشات مالی») با فرزند `/reports` («همه گزارش‌ها»)؛ ۴ آیتم گزارش از گروه «مالی» برداشته شد.
- صفحه جدید `app/(app)/reports/page.tsx` — مقصد منو با حالت خالی تا انتخاب گزارش‌ها؛ گیت `canAccessMenu('/reports')`.
- نقش‌های دارای مجوز گزارش قدیمی: فرم نقش‌ها فقط چک‌باکس‌های کاتالوگ را می‌فرستد → ورودی‌های قدیمی در اولین ذخیره حذف می‌شوند؛ خطایی نمی‌دهد.

## در انتظار تصمیم کاربر
~~فهرست ≤۷ گزارش پیشنهادی ارائه شد~~ → کاربر ۱، ۳، ۴، ۷ را انتخاب کرد (2026-10-04).

## دور ۲ — ساخت گزارش‌های انتخابی (۱، ۳، ۴، ۷)

**قید کاربر:** گزارش‌ها باید ساختار کلی بک‌آفیس فروشگاه را رعایت کنند؛ هدر سیاه ممنوع.

### ساخته‌شده‌ها
- `lib/financial-reports.ts` — چهار سرویس با معناشناسی lib/accounting.ts (payable = amount − discountAmount + shippingCost؛ فقط سفارش‌های حساب‌دار userId≠null؛ فروش مؤثر = غیر pending/cancelled). درصد پورسانت از getLicense.
  1. `financialSummary` — سطر روز/ماه از خود Order.date (کلید با سال)، فیلتر bucket/sales/delivery + از/تا؛ کارمزد و خالص مالک هر سطر.
  2. `couponReport` — هر کد: استفاده یکتا (CouponRedemption)، سفارش، مشتری یکتا، فروش، تخفیف، سهم٪، آخرین استفاده؛ کد حذف‌شده هم از سفارش‌ها دیده می‌شود.
  3. `commissionReport` — سطر ماهانه: فروش مشمول، کارمزد (درصد لایسنس در سربرگ ستون)، خالص مالک.
  4. `cashFlowReport` — سطر روزانه از دو دفتر: درگاه (verified؛ تفکیک order_payment/wallet_charge) و کیف پول (order_payment/refund/admin_adjust)؛ شارژ فقط از دفتر درگاه تا دوبار شمارش نشود.
- صفحات: `/reports/summary`، `/reports/coupons`، `/reports/commission`، `/reports/cash-flow` — PageHeader + ListFilterForm (FaDateField جدید: FaDatePicker + hidden input برای فرم GET) + PanelList (هدر روشن) + نوار جمع کل (خلاصه) + ListActions اکسل/چاپ.
- اکسل: `/api/export/{financial-summary,coupon-performance,commission,cash-flow}` با سطر جمع کل و همان فیلترها (نام coupon-performance برای عدم تداخل با /api/export/coupons موجود).
- منو/مجوز: ۴ فرزند زیر گروه «گزارشات مالی»؛ صفحه `/reports` حالا فقط redirect به /reports/summary.
- باگ RSC که در تست پیدا شد: پاس دادن `{ icon }` از صفحه سرور به جدول کلاینت ۵۰۰ می‌دهد (توابع از مرز RSC رد نمی‌شوند) — صفحات سفارشات و حسابداری هم همین باگ نهفته را داشتند (با فیلتر فعال کرش می‌کردند). الگوی fix: جدول کلاینت `filtered?: boolean` می‌گیرد و آیکون را خودش انتخاب می‌کند — در OrdersTable/AccountingTable و ۴ جدول گزارش اعمال شد.

### راستی‌آزمایی
- tsc/lint/build سبز؛ تست ران‌تایم با Core prod روی 3101 (validate 200) و فروشگاه 3005.
- خلاصه مالی: ۳ سفارش — فروش خالص ۵۳۹٬۱۸۰٬۰۰۰، کارمزد ۱۰٪ = ۵۳٬۹۱۸٬۰۰۰، خالص مالک ۴۸۵٬۲۶۲٬۰۰۰ (ریاضی سطرها و جمع کل منطبق).
- کدهای تخفیف: WEL10 — استفاده ۱، فروش ۲۶۹٬۵۰۰٬۰۰۰، تخفیف ۱۳۴٬۷۵۰٬۰۰۰، سهم ۵۰٪.
- کارمزد: سربرگ «کارمزد (۱۰٪)» از لایسنس؛ جریان نقدی: ۳ روز ردیف.
- اکسل هر ۴ گزارش: 200 + xlsx (~۷KB). `/reports/monthly-sales` قدیمی 404. سرریز افقی صفر. هدر جدول‌ها روشن (rgba(248,250,252,.8)) — بدون هدر سیاه.
- گیت بصری: subagent judge در دسترس نبود → بازبینی خودی با اسکرین‌شات (summary + coupons) و DOM (سه گزارش دیگر).

### باقی برای بعد
- موبایل گزارش‌ها: همان مسیر PanelList (کارت خودکار) — کامپوننت مشترک در دور ۲ موبایل تأیید شده؛ اسکرین‌شات موبایل اختصاصی گرفته نشد (IAB viewport ثابت).
- گزارش‌های ۲ (درگاه‌ها)، ۵ (مرجوعی)، ۶ (مطالبات باز) هنوز ساخته نشده‌اند — در صورت درخواست کاربر.
- سمت بک‌آفیس کور (core/app/panel/reports/*) هنوز از lib/reports.ts قدیمی می‌خواند؛ اگر گزارش‌های کور هم باید با همین ۴ گزارش هم‌تراز شود، دور جداگانه است.

## دور ۳ — راهنمای ستون‌ها، چاپ و قانون جدید تاریخ (2026-10-05)

**درخواست کاربر:** (۱) راهنمای فیلد کنار سربرگ ستون‌ها (tooltip با منبع/فرمول)؛ (۲) چاپ گزارش بی‌فایده بود؛ (۳) قانون مطلق: هر انتخاب تاریخ = PersianDateTimePicker مستقیم، دسکتاپ dropdown/popover و موبایل modal — و حذف کامل FaDatePicker.

### انجام‌شده
- **PanelList.headerHint**: هر ستون می‌تواند `headerHint` بگیرد — آیکون سؤال کم‌جان کنار سربرگ با Tooltip چندخطی؛ `aria-label` کامل (دسترس‌پذیر)، در چاپ پنهان. هر ۲۹ ستون چهار گزارش راهنما گرفتند (فرمول/منبع هر عدد: baseAmount، discountAmount، payable، ledger رستمی، درصد لایسنس، دو دفتر درگاه/کیف پول…).
- **چاپ**: قواعد سراسری @media print در app/globals.css کامل شد (Notifications پنهان، ScrollContainer بدون overflow، tr بدون break، AppShell padding صفر) و در PanelList.module.css (فونت ۱۰px، سلول ۳×۵px، white-space normal، headerHint/expand/mobileCards پنهان). MoneyCell گزارش‌ها بدون کلمه «تومان» شد و هر صفحه زیرنویس «واحد مبالغ: تومان» گرفت — جدول ۹ستونه کامل در عرض A4 (۷۰۳px) جا می‌شود؛ پیش‌نمایش چاپ با تزریق همان قواعد اسکرین‌شات و تأیید شد.
- **PersianDateTimePicker**: `dropdownType` حالا `'auto'` پیش‌فرض است (useMediaQuery: دسکتاپ popover، موبایل modal)؛ `description` اضافه شد؛ دکمه‌های روز `data-today` + aria-label گرفتند (تست‌پذیری/دسترس‌پذیری).
- **حذف FaDatePicker** (فایل + تستش): مصرف‌کنندگان مستقیم شدند — FaDateField (فیلتر GET) و PickupDateFilter روی FaDateField ساده شدند و هر سه فیلد تاریخ فرم کوپن (انقضا/از/تا بازه خرید) با helper محلی CouponDateField روی PersianDateTimePicker. dropdownType ثابت modal از PickupRescheduleForm هم برداشته شد (auto حاکم است).
- تست جدید components/PersianDateTimePicker/PersianDateTimePicker.test.tsx (jest): باز شدن تقویم، انتخاب امروز، خروجی YYYY-MM-DD بدون خطا — پاس. polyfill matchMedia داخل تست.
- حافظه‌ها: date-picker-rule بازنویسی شد (مستقیم، بدون آداپتور؛ قرارداد value/valueFormat؛ الگوهای FaDateField و CouponDateField) + rule 8 پنل به‌روز؛ FaDatePicker ممنوع.

### راستی‌آزمایی
- tsc/بیلد سبز؛ jest تست پیکر پاس؛ لینت فایل‌های جدید تمیز (۳۴ خطای پیش‌موجود فقط در پوشه قدیمی PersianDateTimePicker/*).
- مرورگر: ۹ tooltip با متن فرمول در DOM و دیده‌شده؛ popover تقویم در دسکتاپ باز شد؛ در ۳۷۵px modal باز شد (matchesMobile=true، modalOpen=true، overflow=0)؛ زیرنویس واحد و اعداد بدون «تومان» ✓.

### باقی برای بعد (به‌روز)
- موبایل گزارش‌ها تأیید شد (همان دور + viewport 375 این دور برای پیکر).
- گزارش‌های ۲/۵/۶ همچنان در صورت درخواست؛ هم‌ترازی سمت بک‌آفیس کور جدا است.

## وضعیت
- تایپ‌چک/بیلد سبز؛ لینت فایل‌های تغییریافته پاک (۲ warning پیش‌موجود no-console در core-license).
- گیت بصری: ساب‌ایجنت visual-judge در دسترس نبود (provider error) → بازبینی خودی: سایدبار ۱۰ گروه با گروه جدید هم‌تراز/هم‌سبک؛ صفحه /reports تمیز.
- سرورهای تستی (3005/3101) خاموش شدند؛ پراسس‌های کاربر (3000، 3100) دست‌نخورده.

## دور ۴ — باگ سرریز popover تقویم (2026-10-05، گزارش کاربر)

**مشکل:** در popover و modal تقویم، آیتم‌ها از باکس بیرون می‌زدند. علت دقیق (اندازه‌گیری DOM): dropdown عرض ثابت ۳۲۰px + padding ۱۰px داشت ولی Stackِ محتوا هم به زور width:320 می‌گرفت → ۲۰px + حاشیه منفی Grid (۳۲۲px) بیرون می‌زد (scrollWidth=331). اصلاح: Stack داخل همه حالت‌ها width:100% ظرف خودش را پر می‌کند.

**نکته مهم عملیاتی:** بین دو اجرا بخشی از فایل PersianDateTimePicker.tsx (و دو prop از FaDateField) به نسخه قدیمی برگشته بود (هم‌زمان با عملیات git کاربر؛ کامیت ba42bc2 نسخه جدید را داشته) — همه اصلاحات (dropdownType=auto با popover دسکتاپ/modal موبایل، description، fullWidth/hideLabel، data-today و aria-label روزها، md در baseSizes) دوباره اعمال و این بار با ممیزی grep پس از هر تغییر قفل شد. dropdownType ثابت modal از PickupManager هم حذف شد (روی دسکتاپ modal باز می‌کرد). سه فایل دیگر (export/coupons، export/users، MagazineTeaser) که خط import faJalaliDate شان خالی شده بود از HEAD بازیابی شدند.

**تأیید:** tsc/بیلد سبز، تست پیکر پاس؛ popover دسکتاپ innerOverflow=0 و صفحه overflow=0؛ در ۳۷۵px modalOpen=true و popover بسته؛ در دسکتاپ popover (نه modal) باز می‌شود.
