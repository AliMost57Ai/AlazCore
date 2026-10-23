/**
 * تشخیص «در حال استفاده» درگاه/پنل پیامکی — سرویسی برای پنل Core تا قاعده
 * حذف تخصیصِ در-حال-استفاده را بدون دسترسی مستقیم به دیتابیس سایت اعمال کند.
 *
 * POST /api/core/integration-usage  { gateways?: string[], sms?: string[] }
 *   → { gateways: { [id]: boolean }, sms: { [id]: boolean } }
 *
 * «در حال استفاده» = تنظیمات واردشده (AppConfig با پیشوند شناسه و مقدار
 * غیرخالی) و برای درگاه‌ها همچنین تراکنش ثبت‌شده (OnlinePaymentTransaction).
 * احراز با x-core-key؛ اتصال سایت با هدر x-site-domain.
 */

import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ensureCoreSiteDb, enterSiteContext } from '@/lib/site-context';

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

function ids(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim())
    : [];
}

/**
 * آیا برای این شناسه ردیف تنظیمات غیرخالی هست؟ پیشوند مثل raw SQL قبلی:
 * مقایسه lowercase تا قالب کلیدها (mellat_terminal_id و……) بماند.
 */
async function configured(ids: string[]): Promise<Set<string>> {
  const inUse = new Set<string>();
  if (ids.length === 0) {
    return inUse;
  }
  const rows = await prisma.appConfig.findMany({ select: { key: true, value: true } });
  for (const id of ids) {
    const prefix = id.toLowerCase();
    if (
      rows.some(
        (row) =>
          row.key.toLowerCase().startsWith(prefix) && row.value.trim() !== ''
      )
    ) {
      inUse.add(id);
    }
  }
  return inUse;
}

export async function POST(request: NextRequest) {
  const denied = authorize(request);
  if (denied) {
    return denied;
  }
  // enterSiteContext باید در فریم خودِ handler زده شود (نه داخل هلپر await‌شده).
  const domain = await ensureCoreSiteDb(request);
  if (!domain) {
    return NextResponse.json(
      { error: 'دامنه ارسال نشده یا دیتابیس سایت آماده نیست.' },
      { status: 400 }
    );
  }
  enterSiteContext(domain);

  let body: { gateways?: unknown; sms?: unknown };
  try {
    body = (await request.json()) as { gateways?: unknown; sms?: unknown };
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const gatewayIds = ids(body.gateways);
  const smsIds = ids(body.sms);

  try {
    const [gateways, sms, transacted] = await Promise.all([
      configured(gatewayIds),
      configured(smsIds),
      gatewayIds.length > 0
        ? prisma.onlinePaymentTransaction.groupBy({
            by: ['gateway'],
            where: { gateway: { in: gatewayIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);
    // تراکنش ثبت‌شده هم «استفاده» است حتی بدون تنظیمات واردشده.
    for (const row of transacted) {
      if (row._count._all > 0) {
        gateways.add(row.gateway);
      }
    }
    return NextResponse.json({
      gateways: Object.fromEntries(gatewayIds.map((id) => [id, gateways.has(id)])),
      sms: Object.fromEntries(smsIds.map((id) => [id, sms.has(id)])),
    });
  } catch (error) {
    console.error('[api/core/integration-usage] failed:', error);
    return NextResponse.json({ error: 'بررسی وضعیت استفاده ناموفق بود.' }, { status: 500 });
  }
}
