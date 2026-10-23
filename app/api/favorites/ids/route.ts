import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { getFavoriteIds } from '@/lib/favorites';

export const dynamic = 'force-dynamic';

/**
 * GET /api/favorites/ids — فقط شناسه‌های علاقه‌مندی کاربر جاری؛ قلب‌های ویترین
 * با یک درخواست مشترک (کش ماژول‌سطح) حالت اولیه‌شان را می‌گیرند. ۴۰۱ برای
 * مهمان یعنی «وارد نشده» — قلب همان حالا به /login می‌فرستد.
 */
export async function GET() {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const ids = await getFavoriteIds(session.sub);
  return NextResponse.json({ ids }, { headers: { 'Cache-Control': 'no-store' } });
}
