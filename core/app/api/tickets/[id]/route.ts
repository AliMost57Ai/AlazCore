import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/auth';
import { addTicketMessage, getTicketFull, markTicketRead, setTicketStatus } from '@/lib/tickets';

const VALID_STATUS = ['open', 'answered', 'closed'];

/** GET /api/tickets/[id] — یک تیکت با رشته کامل؛ بازکردنش آن را برای پشتیبان کور خوانده می‌کند. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/tickets');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;
  const ticket = await getTicketFull(id);
  if (!ticket) {
    return NextResponse.json({ error: 'تیکت یافت نشد.' }, { status: 404 });
  }

  await markTicketRead(id, 'core');
  return NextResponse.json({ ticket }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * POST /api/tickets/[id] — پاسخ پشتیبان یا تغییر وضعیت.
 * پاسخ با addTicketMessage ثبت و وضعیت به answered می‌رود؛ تیکت بسته پیام
 * نمی‌پذیرد (اول بازگشایی). 'open' صریح = بازگشایی دستی پشتیبان.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/panel/tickets', 'edit');
  if (session instanceof Response) {
    return session;
  }

  const { id } = await ctx.params;

  let body: { body?: unknown; status?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const message = typeof body.body === 'string' ? body.body : '';
  const status =
    typeof body.status === 'string' && VALID_STATUS.includes(body.status) ? body.status : null;

  if (!message && !status) {
    return NextResponse.json({ error: 'متن پاسخ یا وضعیت جدید لازم است.' }, { status: 400 });
  }

  if (message) {
    const result = await addTicketMessage(id, { side: 'core', name: session.name }, message);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }

  if (status) {
    const result = await setTicketStatus(id, status as 'open' | 'answered' | 'closed');
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
  }

  return NextResponse.json({ ok: true });
}
