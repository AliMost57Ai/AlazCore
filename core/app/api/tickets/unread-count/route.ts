import { NextResponse, type NextRequest } from 'next/server';
import { requireApiSession } from '@/lib/auth';
import { countUnreadForCore, latestUnreadForCore } from '@/lib/tickets';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tickets/unread-count — شمار زندهٔ تیکت‌های در انتظار پشتیبان برای
 * watcher کلاینت پنل (هر ۳۰ ثانیه visibility-gated)؛ latest برای متن اعلان
 * «تیکت جدید». همان قاعده نخوانده مشتق بج منو.
 */
export async function GET(_request: NextRequest) {
  const session = await requireApiSession();
  if (session instanceof Response) {
    return session;
  }

  const [count, latest] = await Promise.all([countUnreadForCore(), latestUnreadForCore()]);
  return NextResponse.json({ count, latest }, { headers: { 'Cache-Control': 'no-store' } });
}
