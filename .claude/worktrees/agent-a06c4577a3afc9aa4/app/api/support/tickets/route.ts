import { NextResponse, type NextRequest } from 'next/server';
import { normalizePhone } from '@/lib/users';
import { getAppSettings } from '@/lib/settings';
import {
  createCustomerTicket,
  createGuestTicket,
  listTicketsForAdmin,
  listTicketsForCustomer,
  listTicketsForGuestToken,
} from '@/lib/support';
import { resolveStorefrontViewer, supportDisabled, SUPPORT_COOKIE, SUPPORT_COOKIE_MAX_AGE } from '@/lib/support-auth';
import type { SupportTicketStatus } from '@/lib/support-status';

interface TicketBody {
  subject?: unknown;
  body?: unknown;
  /** Guest-only identifiers — required when the caller has no session. */
  name?: unknown;
  phone?: unknown;
}

/**
 * GET /api/support/tickets — the caller's own tickets.
 *
 * A customer sees their tickets, a guest the ones behind their cookie token,
 * and a supporter the whole panel list (with the status/unread/search filters
 * and paging the panel passes as query params).
 *
 * A visitor with neither session nor guest cookie gets an empty list rather than
 * a 401: the chat widget polls this from the storefront, and "you have no
 * conversations yet" is the honest answer for someone who has never written in.
 */
export async function GET(request: NextRequest) {
  const resolved = await resolveStorefrontViewer();
  if (!resolved.ok) {
    return resolved.response;
  }
  const viewer = resolved.viewer;

  if (viewer?.kind === 'staff') {
    const params = request.nextUrl.searchParams;
    const status = params.get('status') ?? 'all';
    const page = Number.parseInt(params.get('page') ?? '1', 10);

    const result = await listTicketsForAdmin({
      status: (status === 'open' || status === 'answered' || status === 'closed'
        ? status
        : 'all') as SupportTicketStatus | 'all',
      unreadOnly: params.get('unread') === '1',
      q: params.get('q') ?? undefined,
      page: Number.isFinite(page) ? page : 1,
    });
    return NextResponse.json(result);
  }

  // Support switched off: the panel keeps working, the storefront does not.
  const settings = await getAppSettings();
  if (!settings.supportEnabled) {
    return supportDisabled();
  }

  if (viewer === null) {
    return NextResponse.json({ tickets: [] });
  }

  const tickets =
    viewer.kind === 'customer'
      ? await listTicketsForCustomer(viewer.userId)
      : await listTicketsForGuestToken(viewer.token);

  return NextResponse.json({ tickets });
}

/**
 * POST /api/support/tickets — open a ticket.
 *
 * A signed-in customer sends { subject, body }; a guest sends { name, phone,
 * body } and gets the capability cookie that ties their later visits to this
 * ticket. Subject is derived from the message for guests.
 *
 * This is the one support route that resolves the viewer instead of requiring
 * one: a first-time guest arrives with no session *and* no cookie, and handing
 * out that cookie is exactly what this route does.
 */
export async function POST(request: NextRequest) {
  const resolved = await resolveStorefrontViewer();
  if (!resolved.ok) {
    return resolved.response;
  }
  const viewer = resolved.viewer;

  if (viewer?.kind === 'staff') {
    // Staff answer tickets, they do not open them.
    return NextResponse.json({ error: 'کارمندان از این مسیر تیکت ثبت نمی‌کنند.' }, { status: 403 });
  }

  const settings = await getAppSettings();
  if (!settings.supportEnabled) {
    return supportDisabled();
  }

  let body: TicketBody;
  try {
    body = (await request.json()) as TicketBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const message = typeof body.body === 'string' ? body.body : '';

  if (viewer?.kind === 'customer') {
    const result = await createCustomerTicket({
      userId: viewer.userId,
      name: viewer.name,
      subject: typeof body.subject === 'string' ? body.subject : '',
      body: message,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ticket: result.value }, { status: 201 });
  }

  // Guest: name and mobile number are required before the first message.
  const phone = typeof body.phone === 'string' ? normalizePhone(body.phone) : null;
  const result = await createGuestTicket({
    name: typeof body.name === 'string' ? body.name : '',
    phone: phone ?? '',
    body: message,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const response = NextResponse.json(
    { ticket: { id: result.value.id, displayId: result.value.displayId } },
    { status: 201 }
  );
  response.cookies.set({
    name: SUPPORT_COOKIE,
    value: result.value.token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SUPPORT_COOKIE_MAX_AGE,
  });
  return response;
}
