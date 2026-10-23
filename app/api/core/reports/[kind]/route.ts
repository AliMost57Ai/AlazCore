/**
 * گزارشات سمت Core — فقط از راه API و با کلید x-core-key؛ پنل Core اجازه
 * ندارد دیتابیس سایت‌ها را مستقیم بخواند (قاعده تبادل دیتا بین دو اپ).
 *
 * GET /api/core/reports/[kind]?from=&to=&categoryId=&productName=
 *   kind: products | product-sales | monthly-sales | sales | categories
 *
 * اتصال به دیتابیس همان سایت با هدر x-site-domain (core کلاینت ست می‌کند؛
 * فقط بعد از احراز x-core-key معتبر است). محاسبات همان lib/reports.ts مالک است.
 */

import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { ensureCoreSiteDb, enterSiteContext } from '@/lib/site-context';
import {
  listOwnerCategories,
  ownerMonthlySales,
  ownerProductSales,
  ownerProductsReport,
  ownerRevenueReport,
} from '@/lib/reports';

/** کلید API مشترک با Core — همان اعتمادی که برای /api/validate برعکس است. */
/** مقایسه ثابت-زمانه کلید مشترک (گارد تایمینگ). */
function keyEquals(provided: string, expected: string): boolean {
  const bufA = Buffer.from(provided);
  const bufB = Buffer.from(expected);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function authorize(request: NextRequest): NextResponse | null {
  const expected = process.env.CORE_API_KEY;
  const provided = request.headers.get('x-core-key') ?? '';
  if (!expected) {
    return NextResponse.json(
      { error: 'سرویس Core روی این فروشگاه تنظیم نشده است.' },
      { status: 403 }
    );
  }
  if (!keyEquals(provided, expected)) {
    return NextResponse.json({ error: 'کلید API نامعتبر است.' }, { status: 401 });
  }
  return null;
}

function one(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key);
  return value && value.trim() ? value.trim() : undefined;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const denied = authorize(request);
  if (denied) {
    return denied;
  }

  // اتصال درخواست سمت‌سروری Core به دیتابیس سایت مقصد (multi-tenant) — دامنه
  // صریح از x-site-domain (معتبر چون x-core-key احراز شد)؛ enterSiteContext
  // باید در فریم خودِ handler زده شود، نه داخل هلپر await‌شده.
  const domain = await ensureCoreSiteDb(request);
  if (!domain) {
    return NextResponse.json(
      { error: 'دامنه ارسال نشده یا دیتابیس سایت آماده نیست.' },
      { status: 400 }
    );
  }
  enterSiteContext(domain);

  const { kind } = await ctx.params;
  const params = request.nextUrl.searchParams;
  const filters = {
    from: one(params, 'from'),
    to: one(params, 'to'),
    categoryId: one(params, 'categoryId'),
    productName: one(params, 'productName'),
  };

  try {
    switch (kind) {
      case 'products':
        return NextResponse.json(await ownerProductsReport(filters));
      case 'product-sales':
        return NextResponse.json(await ownerProductSales(filters));
      case 'monthly-sales':
        return NextResponse.json(await ownerMonthlySales(filters));
      case 'sales':
        // فقط فروش فیلترشده — درآمد آلازکور را Core با درصد خودش می‌سازد.
        return NextResponse.json(await ownerRevenueReport(filters));
      case 'categories':
        return NextResponse.json({ categories: await listOwnerCategories() });
      default:
        return NextResponse.json({ error: 'نوع گزارش نامعتبر است.' }, { status: 404 });
    }
  } catch (error) {
    // جزئیات خطا فقط در لاگ سرور — پیام درون‌ریز (اسکیمای دیتابیس و…) به
    // سمت فراخوان درز نمی‌کند.
    console.error('[api/core/reports] kind=%s failed:', kind, error);
    return NextResponse.json({ error: 'خواندن داده‌های گزارش ناموفق بود.' }, { status: 500 });
  }
}
