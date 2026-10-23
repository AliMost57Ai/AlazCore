import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { createSupportTicket, listSupportTickets } from '@/lib/support-tickets';

/**
 * پراکسی تیکتینگ مالک↔Core — سیستم تیکت مالک↔پشتیبان کور؛ مالک از پنل
 * فروشگاهش تیکت می‌زند و پشتیبانان کور همان‌ها را در /panel/tickets می‌بینند.
 * گارد منوی /support (همان گیت صفحه؛ token '/support' از پلن Core می‌آید).
 */

/** GET /api/admin/support/tickets — فهرست تیکت‌های این دامنه با نخواندهٔ مشتق. */
export async function GET() {
  const session = await requireApiMenu('/support');
  if (session instanceof NextResponse) {
    return session;
  }

  const tickets = await listSupportTickets();
  if ('error' in tickets) {
    return NextResponse.json({ error: tickets.error }, { status: 502 });
  }
  return NextResponse.json({ tickets });
}

/** POST /api/admin/support/tickets — ثبت تیکت جدید از طرف مالک. */
export async function POST(request: NextRequest) {
  const session = await requireApiMenu('/support');
  if (session instanceof NextResponse) {
    return session;
  }

  let body: { subject?: unknown; body?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.body === 'string' ? body.body.trim() : '';
  if (!subject || !message) {
    return NextResponse.json({ error: 'موضوع و متن پیام الزامی است.' }, { status: 400 });
  }

  const result = await createSupportTicket({ subject, body: message });
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ id: result.id }, { status: 201 });
}
