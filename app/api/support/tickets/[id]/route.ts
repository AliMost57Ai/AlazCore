import { NextResponse, type NextRequest } from 'next/server';
import { getTicketForViewer, markTicketRead } from '@/lib/customer-tickets';
import { getAppSettings } from '@/lib/settings';
import { requireSupportViewer, supportDisabled } from '@/lib/support-viewer';

/**
 * GET /api/support/tickets/[id] — یک تیکت با رشته کامل پیام‌هایش.
 *
 * باز کردن رشته برای همان سمتِ پرسیده‌نده markRead هم می‌زند — همین چیزی است
 * که بج نخواندهٔ لیست مشتری و حباب ویجت را پاک می‌کند. مالکیت در
 * getTicketForViewer اعمال می‌شود و تیکت غریبه مثل تیکت ناموجود ۴۰۴ می‌دهد تا
 * شناسه قابل حدس‌زدن نباشد.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await requireSupportViewer();
  if (viewer instanceof NextResponse) {
    return viewer;
  }

  if (viewer.kind !== 'staff') {
    const settings = await getAppSettings();
    if (!settings.supportEnabled) {
      return supportDisabled();
    }
  }

  const { id } = await ctx.params;
  const ticket = await getTicketForViewer(
    id,
    viewer.kind === 'staff'
      ? { kind: 'staff' }
      : viewer.kind === 'customer'
        ? { kind: 'customer', userId: viewer.userId }
        : { kind: 'guest', token: viewer.token }
  );
  if (!ticket) {
    return NextResponse.json({ error: 'تیکت یافت نشد.' }, { status: 404 });
  }

  // فقط سمتِ همین الان بازکرده — هرگز هر دو سمت، وگرنه بازدید یک طرف بج
  // طرف مقابل را هم پاک می‌کند.
  await markTicketRead(id, viewer.kind === 'staff' ? 'owner' : 'customer');

  return NextResponse.json({ ticket });
}
