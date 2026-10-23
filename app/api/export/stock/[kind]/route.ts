import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { canAccessMenu } from '@/lib/auth';
import { lowStockList, oversellList, reorderList } from '@/lib/stock';
import { stockListWorkbook } from '@/lib/xlsx-export';

/**
 * Exports one of the three stock lists as an .xlsx file. The kind segment
 * picks the list AND the menu grant it requires, so the download matches
 * what the admin sees on /products/{reorder-list,low-stock,oversell}.
 */

const KINDS: Record<string, { menu: string; sheet: string }> = {
  'reorder-list': { menu: '/products/reorder-list', sheet: 'لیست خرید' },
  'low-stock': { menu: '/products/low-stock', sheet: 'رو به اتمام' },
  oversell: { menu: '/products/oversell', sheet: 'خالی‌فروشی' },
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { kind } = await params;
  const config = KINDS[kind];
  if (!config) {
    return NextResponse.json({ error: 'نوع لیست نامعتبر است.' }, { status: 404 });
  }
  if (!canAccessMenu(session, config.menu)) {
    return NextResponse.json({ error: 'دسترسی به این لیست را ندارید.' }, { status: 403 });
  }

  let headers: string[];
  let rows: (string | number)[][];

  if (kind === 'reorder-list') {
    const list = await reorderList();
    headers = ['کالا', 'موجودی فعلی', 'نقطه سفارش', 'کسری موجودی'];
    rows = list.map((row) => [row.name, row.qty, row.threshold, row.threshold - row.qty]);
  } else if (kind === 'low-stock') {
    const list = await lowStockList();
    headers = ['کالا', 'موجودی فعلی', 'حداقل موجودی'];
    rows = list.map((row) => [row.name, row.qty, row.threshold]);
  } else {
    const list = await oversellList();
    headers = ['کالا', 'موجودی فعلی', 'واحد فروخته‌شده (کسری)', 'سقف خالی‌فروشی کالا'];
    rows = list.map((row) => [
      row.name,
      row.qty,
      Math.max(0, -row.qty),
      row.oversellMax ?? 'سقف کل فروشگاه',
    ]);
  }

  const buffer = await stockListWorkbook(config.sheet, headers, rows);
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="stock-${kind}-${today}.xlsx"`,
      // One-off download; caching it in the browser buys nothing.
      'Cache-Control': 'no-store',
    },
  });
}
