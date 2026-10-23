import { NextResponse, type NextRequest } from 'next/server';
import { getAppSettings } from '@/lib/settings';
import { addMessage, getTicketForViewer } from '@/lib/support';
import { requireSupportViewer, supportDisabled } from '@/lib/support-auth';

interface MessageBody {
  body?: unknown;
}

/**
 * POST /api/support/tickets/[id]/messages — reply inside a ticket.
 *
 * The same endpoint serves both sides: the requester's message puts the ticket
 * back to «در انتظار پاسخ», the supporter's marks it «پاسخ داده شده». The
 * author name is taken from the viewer, never from the request body.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  let body: MessageBody;
  try {
    body = (await request.json()) as MessageBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const { id } = await params;

  // Ownership first: a customer must not be able to post into someone else's
  // ticket by guessing its id.
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
  if (ticket.status === 'closed') {
    return NextResponse.json(
      { error: 'این تیکت بسته شده است — برای ادامهٔ گفتگو آن را باز کنید.' },
      { status: 400 }
    );
  }

  const author =
    viewer.kind === 'staff'
      ? { type: 'staff' as const, name: viewer.session.name, id: viewer.session.sub }
      : viewer.kind === 'customer'
        ? { type: 'customer' as const, name: viewer.name, id: viewer.userId }
        : { type: 'customer' as const, name: ticket.requesterName, id: null };

  const result = await addMessage(id, author, typeof body.body === 'string' ? body.body : '');
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: result.value.id }, { status: 201 });
}
