import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { listOrders } from '@/lib/orders';
import { ordersWorkbook } from '@/lib/xlsx-export';

/**
 * Exports the (optionally filtered) order list as an .xlsx file. Takes the
 * same q/status filter params as the orders page, so the download always
 * matches what the admin sees.
 */
export async function GET(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const params = request.nextUrl.searchParams;
  const status = params.get('status') ?? undefined;
  const orders = await listOrders(undefined, {
    search: params.get('q')?.trim() || undefined,
    status: status && status !== 'all' ? status : undefined,
  });

  const buffer = await ordersWorkbook(orders);
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="orders-${today}.xlsx"`,
      // One-off download; caching it in the browser buys nothing.
      'Cache-Control': 'no-store',
    },
  });
}
