import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireApiMenu } from '@/lib/auth';
import {
  checkDomainOpenCap,
  createDomainTicket,
  listTicketsForCore,
  validateTicketInput,
} from '@/lib/tickets';

/** GET /api/tickets — همه تیکت‌ها با نخواندهٔ مشتق سمت کور (هر دو نقش پشتیبانی). */
export async function GET() {
  const session = await requireApiMenu('/panel/tickets');
  if (session instanceof Response) {
    return session;
  }

  const tickets = await listTicketsForCore();
  return NextResponse.json({ tickets });
}

interface TicketBody {
  subject?: unknown;
  domainId?: unknown;
  requesterName?: unknown;
  body?: unknown;
}

/**
 * POST /api/tickets — ثبت تیکت جدید از طرف مالک توسط پشتیبان.
 * سقف ۵ تیکت باز دامنه و displayId مرجع همین‌جا اعمال می‌شود.
 */
export async function POST(request: NextRequest) {
  const session = await requireApiMenu('/panel/tickets', 'edit');
  if (session instanceof Response) {
    return session;
  }

  let body: TicketBody;
  try {
    body = (await request.json()) as TicketBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const input = validateTicketInput(body.subject, body.body);
  if ('error' in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  const domainId = typeof body.domainId === 'string' && body.domainId ? body.domainId : null;
  if (domainId) {
    const domain = await prisma.domain.findUnique({ where: { id: domainId } });
    if (!domain) {
      return NextResponse.json({ error: 'دامنه یافت نشد.' }, { status: 400 });
    }
    const capError = await checkDomainOpenCap(domainId);
    if (capError) {
      return NextResponse.json({ error: capError }, { status: 400 });
    }
  }

  const requesterName =
    typeof body.requesterName === 'string' && body.requesterName.trim()
      ? body.requesterName.trim()
      : domainId
        ? ((await prisma.domain.findUnique({ where: { id: domainId }, select: { ownerName: true } }))
            ?.ownerName || 'مالک سایت')
        : 'مالک سایت';

  const ticket = await createDomainTicket({
    domainId,
    requesterName,
    subject: input.subject,
    body: input.body,
  });
  if (!ticket.ok) {
    return NextResponse.json({ error: ticket.error }, { status: 500 });
  }
  return NextResponse.json({ id: ticket.value.id }, { status: 201 });
}
