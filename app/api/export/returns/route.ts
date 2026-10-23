import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { listReturns } from '@/lib/product-returns';
import { returnsWorkbook } from '@/lib/xlsx-export';

/**
 * Exports the (optionally filtered) returns list as an .xlsx file. Takes the
 * same q/status filter params as the /returns page, so the download always
 * matches what the admin sees.
 */
export async function GET(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const params = request.nextUrl.searchParams;
  const status = params.get('status') ?? undefined;
  const rows = await listReturns({
    q: params.get('q')?.trim() || undefined,
    status: status && status !== 'all' ? status : undefined,
  });

  const buffer = await returnsWorkbook(rows);
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="returns-${today}.xlsx"`,
      // One-off download; caching it in the browser buys nothing.
      'Cache-Control': 'no-store',
    },
  });
}
