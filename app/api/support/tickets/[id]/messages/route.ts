import { NextResponse, type NextRequest } from 'next/server';
import { addMessage, getTicketForViewer } from '@/lib/customer-tickets';
import { getAppSettings } from '@/lib/settings';
import { requireSupportViewer, supportDisabled } from '@/lib/support-viewer';

/**
 * POST /api/support/tickets/[id]/messages — پیام تازه از سمت درخواست‌کننده.
 *
 * نام نویسنده همیشه از هویت سمت سرور می‌آید، هرگز از بدنه درخواست. تیکت بسته
 * پیام نمی‌پذیرد (خطای فارسی) — بازگشایی فقط اکشن صریح پشتیبان از پنل است.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await requireSupportViewer();
  if (viewer instanceof NextResponse) {
    return viewer;
  }
  if (viewer.kind === 'staff') {
    // پاسخ پشتیبان از مسیر پنل (/api/admin/tickets/[id]) می‌رود.
    return NextResponse.json({ error: 'پاسخ پشتیبان از مسیر پنل ثبت می‌شود.' }, { status: 403 });
  }

  const settings = await getAppSettings();
  if (!settings.supportEnabled) {
    return supportDisabled();
  }

  const { id } = await ctx.params;

  // مالکیت اول — تیکت غریبه ۴۰۴ می‌خورد، قبل از هر چیز دیگری.
  const ticket = await getTicketForViewer(
    id,
    viewer.kind === 'customer'
      ? { kind: 'customer', userId: viewer.userId }
      : { kind: 'guest', token: viewer.token }
  );
  if (!ticket) {
    return NextResponse.json({ error: 'تیکت یافت نشد.' }, { status: 404 });
  }

  let body: { body?: unknown; imagePath?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const result = await addMessage(
    id,
    { side: 'customer', name: ticket.requesterName },
    typeof body.body === 'string' ? body.body : '',
    body.imagePath
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: result.value.id }, { status: 201 });
}
