import { NextResponse } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { getOwnerAllowedCatalog } from '@/lib/owner-catalog';

/**
 * GET /api/admin/settings/assigned — کاتالوگ مجازِ مالک: تخصیص‌های Core +
 * مواردی که مالک قبلاً در دیتابیس خودش کانفیگ کرده (این‌ها همیشه می‌مانند).
 * themes/ipg/bnpl/sms = null یعنی بدون محدودیت (Core تنظیم نشده).
 */
export async function GET() {
  const session = await requireApiMenu('/settings/payment');
  if (session instanceof NextResponse) {
    return session;
  }

  const catalog = await getOwnerAllowedCatalog();
  return NextResponse.json(
    {
      catalog: catalog ?? {
        themes: null,
        ipg: null,
        bnpl: null,
        sms: null,
        sources: { assigned: false, localConfigured: false },
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
