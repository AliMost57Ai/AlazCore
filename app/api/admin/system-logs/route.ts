import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAdmin } from '@/lib/api-auth';
import { clearSystemLogs, listSystemLogs, type SystemLogKind } from '@/lib/system-logs';

/** Parses ?kind= into a valid filter (absent = all kinds). */
function parseKind(request: NextRequest): SystemLogKind | undefined {
  const raw = request.nextUrl.searchParams.get('kind');
  return raw === 'gateway' ||
    raw === 'sms' ||
    raw === 'shahkar' ||
    raw === 'access' ||
    raw === 'order'
    ? raw
    : undefined;
}

/** GET /api/admin/system-logs[?kind=gateway|sms] — newest first. */
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
