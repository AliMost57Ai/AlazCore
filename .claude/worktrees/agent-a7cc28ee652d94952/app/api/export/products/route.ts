import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { listProducts } from '@/lib/products';
import { productsWorkbook } from '@/lib/xlsx-export';

/**
 * Exports the (optionally filtered) product list as an .xlsx file — also the
 * template for the price import: rows with an empty «نوع» column update the
 * product price, rows naming a variant update that variant.
 */
export async function GET(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const params = request.nextUrl.searchParams;
  const visibility = params.get('visibility');
  const products = await listProducts({
    search: params.get('q')?.trim() || undefined,
    visibility: visibility === 'true' ? true : visibility === 'false' ? false : undefined,
  });

  const buffer = await productsWorkbook(products);
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="products-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
