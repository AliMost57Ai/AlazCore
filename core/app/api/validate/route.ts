import { NextResponse, type NextRequest } from 'next/server';
import { buildLicenseSnapshot, resolveApiKey } from '@/lib/licensing';

/**
 * POST /api/validate — سرویس اعتبارسنجی لایسنس فروشگاه‌ها.
 *
 * فروشگاه قبل از لود شدن، دامنه خودش را با کلید API در هدر `x-core-key`
 * می‌فرستد؛ پاسخ تعیین‌کننده این است که سایت لود شود، با کدام تم، منوهای
 * ادمینش کدام‌ها باشند و کدام درگاه‌ها/پنل‌های پیامکی برایش فعال است.
 * No-store تا تغییر وضعیت در Core حداکثر تا TTL کش سمت فروشگاه معتبر بماند.
 */
export async function POST(request: NextRequest) {
  const expected = await resolveApiKey();
  if (!expected) {
    return NextResponse.json(
      { error: 'سرویس اعتبارسنجی پیکربندی نشده است (کلید API وجود ندارد).' },
      { status: 503 }
    );
  }

  const provided =
    request.headers.get('x-core-key') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'کلید API نامعتبر است.' }, { status: 401 });
  }

  let domain = '';
  try {
    const body = (await request.json()) as { domain?: unknown };
    domain = typeof body.domain === 'string' ? body.domain : '';
  } catch {
    domain = '';
  }
  // هدر x-core-domain جایگزین body هم پذیرفته می‌شود.
  domain = domain || request.headers.get('x-core-domain') || '';

  if (!domain) {
    return NextResponse.json({ error: 'دامنه ارسال نشده است.' }, { status: 400 });
  }

  const snapshot = await buildLicenseSnapshot(domain);
  // بدنه‌ی ok:false خودش گویاست — کد وضعیت خطا مخصوص کلید/ورودی است.
  return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
}

/** GET هم مجاز است (domain از query) — برای تست مرورگری/سلامت سرویس. */
export async function GET(request: NextRequest) {
  const expected = await resolveApiKey();
  if (!expected) {
    return NextResponse.json({ error: 'سرویس اعتبارسنجی پیکربندی نشده است.' }, { status: 503 });
  }
  const provided = request.headers.get('x-core-key');
  if (provided !== expected) {
    return NextResponse.json({ error: 'کلید API نامعتبر است.' }, { status: 401 });
  }
  const domain = request.nextUrl.searchParams.get('domain') ?? '';
  if (!domain) {
    return NextResponse.json({ error: 'دامنه ارسال نشده است.' }, { status: 400 });
  }
  const snapshot = await buildLicenseSnapshot(domain);
  return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
}
