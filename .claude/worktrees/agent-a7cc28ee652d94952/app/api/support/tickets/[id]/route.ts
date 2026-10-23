import { NextResponse, type NextRequest } from 'next/server';
import { getAppSettings } from '@/lib/settings';
import { getTicketForViewer, markTicketRead, setTicketStatus } from '@/lib/support';
import { requireSupportViewer, supportDisabled } from '@/lib/support-auth';
import { toTicketStatus, type SupportTicketStatus } from '@/lib/support-status';

interface PatchBody {
  status?: unknown;
}

/** Resolves the viewer into the shape lib/support's ownership check expects. */
async function resolveAccess() {
  const viewer = await requireSupportViewer();
  if (viewer instanceof NextResponse) {
    return { error: viewer as NextResponse };
  }
  return { viewer };
}

/**
 * GET /api/support/tickets/[id] — one ticket with its whole thread.
 *
 * Opening the thread also marks it read for whichever side asked, which is
 * what clears the unread marker in the panel list and the storefront bubble.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await resolveAccess();
  if ('error' in access) {
    return access.error;
  }
  const { viewer } = access;

  if (viewer.kind !== 'staff') {
    const settings = await getAppSettings();
    if (!settings.supportEnabled) {
      return supportDisabled();
    }
  }

  const { id } = await params;
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

  // Only the side that just opened it — never both, or the badge the other
  // side is waiting on would be cleared by someone else's visit.
  await markTicketRead(id, viewer.kind === 'staff' ? 'staff' : 'customer');

  return NextResponse.json({ ticket });
}

/** PATCH /api/support/tickets/[id] — close or reopen a ticket (staff only). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await resolveAccess();
  if ('error' in access) {
    return access.error;
  }
  if (access.viewer.kind !== 'staff') {
    return NextResponse.json({ error: 'تغییر وضعیت تیکت فقط برای پشتیبان است.' }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  if (body.status !== 'open' && body.status !== 'answered' && body.status !== 'closed') {
    return NextResponse.json({ error: 'وضعیت تیکت نامعتبر است.' }, { status: 400 });
  }

  const { id } = await params;
  const result = await setTicketStatus(id, body.status as SupportTicketStatus);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ status: toTicketStatus(body.status) });
}
