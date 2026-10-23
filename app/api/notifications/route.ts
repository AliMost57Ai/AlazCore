import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { collectBellSnapshot, latestUnreadSupportTicket } from '@/lib/bell';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications — شمارهای زندهٔ زنگ‌اخبار و بج منو برای watcher کلاینت
 * داشبورد (هر ۳۰ ثانیه visibility-gated). همان محاسبهٔ layout سروری از
 * collectBellSnapshot تا هر دو همیشه یک عدد ببینند؛ latest برای متن اعلان
 * «تیکت جدید» است.
 */
export async function GET(_request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const [snapshot, latest] = await Promise.all([
    collectBellSnapshot(),
    latestUnreadSupportTicket(),
  ]);
  return NextResponse.json(
    { ...snapshot, latest },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
