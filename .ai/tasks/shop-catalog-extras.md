# Task: فیچرهای کاتالوگ فروشگاه — برند، علاقه‌مندی‌ها، سوالات متداول (2026-10-17)

## درخواست کاربر
بعد از رفع باگ‌های تیکتینگ (ticketing-process.md دور ۴): «فیچر سوالات متداول و لیست علاقه‌مندی‌ها را
اضافه کن، به محصول برند اضافه کن، صفحه تعریف برند هم اضافه کن.»

## سند راه‌حل (solution-architect)

**پشته**: فقط فروشگاه (Node.js/Next.js 16 + Mantine 8)؛ SQLite چند‌اجاره‌ای per-site؛ بدون پکیج جدید.

**مدل‌های جدید (schema.prisma)** — مایگریشن `prisma/site-migrations/0005_brands-favorites-faq.sql`
(الگوی RedefineTables با کپی کامل داده؛ اعمال روی هر ۳ دیتابیس سایت با db:migrate-sites + db:push برای app.db):
- `Brand` (id, name, slug @unique, logoPath?, isActive, timestamps) + `Product.brandId?` (SetNull + index).
- `Favorite` (@@id([userId, productId]), Cascade دوطرفه) + رابطه‌های User.favorites / Product.favorites.
- `FaqEntry` (question, answer, sortOrder, isActive, timestamps).

**قواعد رعایت‌شده**: modal-to-page (فرم برند = صفحه اختصاصی؛ فرم FAQ ۳فیلدی = ResponsiveModal)،
هر لیست پنل = PanelList + اکسل (brandsWorkbook/faqWorkbook) + چاپ، قاعده «در حال استفاده» برای حذف برند،
ضد IDOR علاقه‌مندی (userId همیشه از نشست)، اسلاگ فارسی با slugify مشترک، ناوبری URL با
`encodeURIComponent`.

## وضعیت فازها — همه انجام‌شده و دودشده

| فیچر | بک‌آفیس | API | فروشگاه | دود |
|---|---|---|---|---|
| برند | `/brands` (PanelList+اکسل+چاپ)، `/brands/new`، `/brands/[id]/edit`، منوی «کالا» + nav-permissions | `/api/admin/brands` (GET/POST/DELETE) | `/?brand=slug` در app/page.tsx + listProducts، نام برند روی ThemeProductCard/digishop ProductCard (span بیرون anchor)، چیپ برند در ProductView، BrandCarousel دیجی‌مارکت به Brand واقعی (بدون برند = مخفی) | ساخت برند → PATCH محصول → فیلتر → چیپ ✓ |
| محصول×برند | ProductForm فیلد Select برند (new/edit با brandOptions) | validateBrandRef در POST/PATCH محصولات؛ PATCH فقط با کلید صریح brandId بازنویسی می‌کند | — | برندName/Slug در پاسخ ✓ |
| علاقه‌مندی | — | `/api/favorites` (GET/POST/DELETE) + `/api/favorites/ids` | قلب جزیره‌ای FavoriteButton (کش ماژول‌سطح، مهمان → /login?next=/، optimistic) روی دو کارت + ProductView؛ `/account/favorites` + AccountNav | signup تست → افزودن → ids → لیست → صفحه ✓ |
| FAQ | `/settings/faq` (PanelList + ResponsiveModal + سوییچ فعال روی ردیف + اکسل)، منوی «وبسایت» | `/api/admin/faq` + `/api/export/faq` | صفحه عمومی `/faq` (StorefrontChrome + Accordion) — به PUBLIC_PATHS پراکسی اضافه شد؛ لینک فوتر هر ۴ تم به /faq اصلاح/افزوده شد | ایجاد سوال → صفحه عمومی رندر ✓ |

## کشف‌ها و نکات
- فیلتر برند با اسلاک می‌آید (`getActiveBrandIdBySlug`)؛ برند غیرفعال/ناموجود مثل نبودِ فیلتر است.
- قلب‌ها بدون prop-threading بین تم‌ها: هر صفحه یک fetch مشترک `/api/favorites/ids` (کش ماژول).
- لینت پیش‌موجود (۴۷ خطای قدیمی در PersianDateTimePicker/scripts/...) و stylelint ReportDocument
  خارج از محدوده بودند و دست نخوردند؛ tsc هر دو اپ سبز، jest 128/128.

## یادداشت عملیاتی
- سرور dev فروشگاه (3000) با `npm run dev` تغییری نمی‌خواهد؛ سرور prod/داکر بعد از pull:
  `npm run build` + ری‌استارت (تله ChunkLoad). کور: بیلد نهایی قبلاً اعمال و روی 3100 در حال اجراست.
- مایگریشن 0005 در داکر با entrypoint خودکار اعمال می‌شود؛ در محیط ویندوزی: `npm run db:migrate-sites`.
