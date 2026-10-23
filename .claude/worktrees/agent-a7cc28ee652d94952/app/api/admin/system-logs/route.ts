import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAdmin } from '@/lib/api-auth';
import { clearSystemLogs, listSystemLogs } from '@/lib/system-logs';
import { SYSTEM_LOG_KINDS, type SystemLogKind } from '@/lib/system-log-defs';

/** Parses ?kind= into a valid filter (absent/unknown = all kinds). */
function parseKind(request: NextRequest): SystemLogKind | undefined {
  const raw = request.nextUrl.searchParams.get('kind');
  return (SYSTEM_LOG_KINDS as readonly string[]).includes(raw ?? '')
    ? (raw as SystemLogKind)
    : undefined;
}

/** GET /api/admin/system-logs[?kind=gateway|sms|shahkar|user|price|order] — newest first. */
export async function GET(request: NextRequest) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }
  const logs = await listSystemLogs(parseKind(request));
  return NextResponse.json({ logs });
}

/** DELETE /api/admin/system-logs[?kind=…] — the admin page's reset button. */
export async function DELETE(request: NextRequest) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }
  await clearSystemLogs(parseKind(request));
  return NextResponse.json({ ok: true });
}
