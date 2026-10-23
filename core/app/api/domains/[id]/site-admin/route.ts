/**
 * اعتبارنامه ادمین سایت — پروکسی به API فروشگاه (app/api/core/site-admin)
 * با قاعده‌ی API-only: کور دیتابیس سایت را مستقیم نمی‌خواند.
 *
 * GET  /api/domains/[id]/site-admin  → { email, isDefaultPassword }
 * POST /api/domains/[id]/site-admin  { action: 'reset' } → رمز به پیش‌فرض برگردد.
 *
 * احراز: requireApiMenu('/panel/domains', 'edit')؛ سپس shopApi با x-core-key
 * و x-site-domain.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/auth';
import prisma from '@/lib/db';
import { shopApi } from '@/lib/shop-api';

interface SiteAdminInfo {
  email: string;
  isDefaultPassword: boolean;
}

async function loadDomain(id: string) {
  return prisma.domain.findUnique({
    where: { id },
    select: { id: true, domain: true, dbName: true, dbStatus: true },
  });
}

/** GET /api/domains/[id]/site-admin — نام کاربری ادمین سایت + وضعیت رمز. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/domains');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const domain = await loadDomain(id);
  if (!domain) {
    return NextResponse.json({ error: 'دامنه یافت نشد.' }, { status: 404 });
  }
  if (domain.dbStatus !== 'ready') {
    return NextResponse.json(
      { error: 'دیتابیس سایت هنوز provision نشده است — اول provisioning را کامل کنید.' },
      { status: 409 }
    );
  }

  const info = await shopApi<SiteAdminInfo>('/api/core/site-admin', { domain: domain.domain });
  if (!info) {
    return NextResponse.json(
      { error: 'دریافت اطلاعات از فروشگاه ممکن نشد (قطع/کلید/دامنه).' },
      { status: 502 }
    );
  }
  return NextResponse.json(info);
}

/** POST /api/domains/[id]/site-admin {action:'reset'} — بازگرداندن رمز به پیش‌فرض. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/domains', 'edit');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const domain = await loadDomain(id);
  if (!domain) {
    return NextResponse.json({ error: 'دامنه یافت نشد.' }, { status: 404 });
  }
  if (domain.dbStatus !== 'ready') {
    return NextResponse.json(
      { error: 'دیتابیس سایت هنوز provision نشده است — اول provisioning را کامل کنید.' },
      { status: 409 }
    );
  }

  let body: { action?: unknown };
  try {
    body = (await request.json()) as { action?: unknown };
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }
  if (body.action !== 'reset') {
    return NextResponse.json({ error: 'action نامعتبر است.' }, { status: 400 });
  }

  const info = await shopApi<SiteAdminInfo>('/api/core/site-admin', {
    domain: domain.domain,
    body: { action: 'reset' },
  });
  if (!info) {
    return NextResponse.json(
      { error: 'بازنشانی روی فروشگاه ممکن نشد (قطع/کلید/دامنه).' },
      { status: 502 }
    );
  }
  return NextResponse.json(info);
}
