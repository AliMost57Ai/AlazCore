import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { ACTION_LABELS, KIND_LABELS, type SystemLogKind } from '@/lib/system-log-defs';
import { listSystemLogs } from '@/lib/system-logs';
import { stockListWorkbook } from '@/lib/xlsx-export';

const KINDS: SystemLogKind[] = ['gateway', 'sms', 'shahkar', 'access', 'order'];

/** Exports the system-log list (optionally one kind) as an .xlsx file. */
export async function GET(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'دسترسی به این لیست را ندارید.' }, { status: 403 });
  }

  const raw = request.nextUrl.searchParams.get('kind') ?? undefined;
  const kind = KINDS.includes(raw as SystemLogKind) ? (raw as SystemLogKind) : undefined;
  const logs = await listSystemLogs(kind);

  const rows = logs.map((log) => [
    log.createdAt,
    KIND_LABELS[log.kind] ?? log.kind,
    log.provider,
    ACTION_LABELS[log.action] ?? log.action,
    log.actorName || '—',
    log.message,
  ]);

  const buffer = await stockListWorkbook(
    'لاگ‌های سیستمی',
    ['تاریخ و ساعت', 'نوع', 'سرویس', 'عملیات', 'توسط', 'رویداد / خطا'],
    rows
  );
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="system-logs-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
