---
name: git-workflow
description: "قواعد branch و commit این پروژه — برنچ feature/{slug} یا fix/{slug} از روی آخرین برنچ پایه، Conventional Commits (feat/fix/refactor/test/docs/chore)، تمیز بودن فرمتر و سبز بودن تست‌های همان بخش پیش از هر commit، و پیشنهاد PR فقط بعد از تایید نهایی tech-lead. Use whenever creating a branch, committing, or preparing a PR in this repo — «برنچ بساز», «کامیت کن», «pull request», «commit this», «create a branch», «open a PR» — and always ask the user for confirmation before performing any git operation."
---

# قوانین Git و Commit (Git Workflow)

## Branching

- قبل از انجام این فرایند از کاربر سوال شود که: آیا فرایند گیت انجام شود؟ در صورت تایید این مراحل انجام می‌شود.
- برای هر فیچر یا باگ جدید که project-manager پایپ‌لاین را شروع می‌کند، ابتدا یک branch جدید از روی آخرین `main` (یا `develop`، هرکدام که در این پروژه پایه‌ی فعال است) ساخته شود:
  - فیچر: `feature/{slug}` — مثلاً `feature/product-discount`
  - باگ: `fix/{slug}` — مثلاً `fix/cart-quantity-negative`
  - `{slug}` باید کوتاه، انگلیسی، و با خط تیره باشد؛ از عنوان سند solution-architect استخراج شود.
- هیچ نقشی مستقیم روی `main`/`develop` کامیت نمی‌کند.
- اگر فیچر یکپارچه‌سازی بین دو پشته است و هر پشته در ریپازیتوری جدا قرار دارد، همین قواعد branch/commit در هر دو ریپازیتوری به‌صورت مستقل رعایت می‌شود و project-manager هر دو را در فایل وضعیت ردیابی می‌کند.

## Commit

- از Conventional Commits استفاده شود: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`. مثال: `feat(cart): add quantity validation on add-to-cart`.
- هر commit باید یک واحد سالم باشد: فقط بعد از اینکه فرمتر مربوط به پشته تمیز اجرا شده و (در صورت وجود تست مرتبط) تست‌های همان بخش سبز هستند.
  - پشته Node.js/Next.js: `npm run lint -- --fix` و `npx prettier --write .`
  - پشته .NET: `dotnet format`
- نقاط commit پیشنهادی در طول پایپ‌لاین:
  - بعد از db-architect: `feat(db): add discount column to products table`
  - بعد از nodejs-developer/dotnet-developer/nextjs-frontend-developer: یک یا چند commit به تفکیک منطقی تغییر (نه یک commit غول‌پیکر شامل همه‌چیز)
  - بعد از qa-tester: `test: cover discount edge cases`
  - بعد از رفع مشکلات security-reviewer یا tech-lead: commit جداگانه با `fix:` که به مشکل اشاره می‌کند
- پیام commit نباید شامل جزئیات داخلی گردش‌کار نقش‌ها باشد (مثلاً ننویسید «security-reviewer تایید کرد»)؛ فقط تغییر واقعی کد را توصیف کند.

## Pull Request (در صورت وجود remote/CI)

- بعد از تایید نهایی tech-lead، project-manager باید به کاربر پیشنهاد بدهد PR باز شود؛ خودش PR باز نمی‌کند مگر کاربر صریحاً بخواهد.
- عنوان PR باید معیار پذیرش سند solution-architect را در قالب checklist بازتاب دهد.

## استثناها

- تغییرات اضطراری/hotfix که کاربر صریحاً بخواهد مستقیم روی `main` اعمال شود، از این قانون مستثنی است — اما project-manager باید صراحتاً این استثنا را به کاربر یادآوری و از او تاییدِ آگاهانه بگیرد.
