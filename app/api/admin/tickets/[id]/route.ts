import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import {
  addMessage,
  getTicketForViewer,
  markTicketRead,
  setTicketStatus,
} from '@/lib/customer-tickets';

const VALID_STATUS = ['open', 'answered', 'closed'];

/** GET /api/admin/tickets/[id] — یک تیکت با رشته کامل؛ بازکردنش آن را برای پشتیبان خوانده می‌کند. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/customer-support', 'view');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await ctx.params;
  const ticket = await getTicketForViewer(id, { kind: 'staff' });
  if (!ticket) {
    return NextResponse.json({ error: 'تیکت یافت نشد.' }, { status: 404 });
  }

  await markTicketRead(id, 'owner');
  return NextResponse.json({ ticket });
}

/**
 * POST /api/admin/tickets/[id] — پاسخ/وضعیت پشتیبان.
 *
 * پاسخ با addMessage ثبت و وضعیت را خودکار به answered می‌برد؛ تیکت بسته پیام
 * نمی‌پذیرد (اول بازگشایی). تغییر وضعیت صریح ('open' بازگشایی / 'closed' بستن /
 * 'answered' علامت‌گذاری پاسخ‌داده‌شده) مسیر setTicketStatus است. action 'close'
 * برای سازگاری با فرم قدیمی همان 'closed' است.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/customer-support', 'view');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await ctx.params;

  let body: { body?: unknown; status?: unknown; action?: unknown; imagePath?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const message = typeof body.body === 'string' ? body.body : '';
  const rawStatus =
    typeof body.status === 'string' && VALID_STATUS.includes(body.status) ? body.status : null;
  const status = body.action === 'close' ? 'closed' : rawStatus;

  if (!message && !status) {
    return NextResponse.json({ error: 'متن پیام یا وضعیت لازم است.' }, { status: 400 });
  }

  if (message) {
    const result = await addMessage(
      id,
      { side: 'owner', name: session.name },
      message,
      body.imagePath
    );
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
