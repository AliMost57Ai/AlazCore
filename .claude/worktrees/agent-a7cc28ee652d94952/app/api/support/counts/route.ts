import { NextResponse } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { getTicketStatsForStaff } from '@/lib/support';

/**
 * GET /api/support/counts — the panel bell's two counters, polled by
 * components/layout/NotificationsMenu.tsx.
 *
 * Staff-side only, so it ignores the supportEnabled switch on purpose: turning
 * the storefront chat off must not blind the panel to tickets already open.
 */
export async function GET() {
  const session = await requireApiMenu('/support');
  if (session instanceof NextResponse) {
    return session;
  }

  return NextResponse.json(await getTicketStatsForStaff());
}
