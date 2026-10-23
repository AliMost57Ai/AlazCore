import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { getSupportTicket, replySupportTicket } from '@/lib/support-tickets';

/**
 * GET /api/admin/support/tickets/[id] — یک تیکت با رشته کامل؛ GET سمت کور
 * بازدید مالک را هم ثبت می‌کند (بج نخوانده ویو مالک پاک می‌شود).
 * POST — پاسخ مالک؛ وضعیت خودکار به open «در انتظار پاسخ» می‌رود.
 * گارد منوی /support — همان گیت صفحه.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/support');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await ctx.params;
  const ticket = await getSupportTicket(id);
  if ('error' in ticket) {
    return NextResponse.json({ error: ticket.error }, { status: 502 });
  }
  return NextResponse.json({ ticket });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/support');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await ctx.params;
  let body: { body?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const message = typeof body.body === 'string' ? body.body.trim() : '';
  if (!message) {
    return NextResponse.json({ error: 'متن پیام لازم است.' }, { status: 400 });
  }

  const result = await replySupportTicket(id, { body: message });
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
