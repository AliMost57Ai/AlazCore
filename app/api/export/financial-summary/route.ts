import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { canAccessMenu } from '@/lib/auth';
import { financialSummary, normalizeSummaryFilters } from '@/lib/financial-reports';
import { stockListWorkbook } from '@/lib/xlsx-export';

/**
 * خروجی اکسل خلاصه مالی دوره — همان فیلترهای صفحه و با سطر جمع کل در انتها.
 */
export async function GET(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canAccessMenu(session, '/reports/summary')) {
    return NextResponse.json({ error: 'دسترسی به این گزارش را ندارید.' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const get = (key: string): string | undefined => params.get(key) ?? undefined;
  const filters = normalizeSummaryFilters({
    from: get('from'),
    to: get('to'),
    bucket: get('bucket'),
    sales: get('sales'),
    delivery: get('delivery'),
  });

  const { rows, totals } = await financialSummary(filters);
  const dataRows = rows.map((row) => [
    row.label,
    row.orders,
    row.grossList,
    row.discounts,
    row.shipping,
    row.net,
    row.collected,
    row.outstanding,
    row.commission,
    row.ownerNet,
  ]);
  dataRows.push([
    'جمع کل',
    totals.orders,
    totals.grossList,
    totals.discounts,
    totals.shipping,
    totals.net,
    totals.collected,
    totals.outstanding,
    totals.commission,
    totals.ownerNet,
  ]);

  const buffer = await stockListWorkbook(
    'خلاصه مالی دوره',
    [
      'دوره',
      'سفارش‌ها',
      'فروش لیست (تومان)',
      'تخفیف‌ها (تومان)',
      'هزینه ارسال (تومان)',
      'فروش خالص (تومان)',
      'وصول‌شده (تومان)',
      'در انتظار تسویه (تومان)',
      'کارمزد (تومان)',
      'خالص مالک (تومان)',
    ],
    dataRows
  );
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="financial-summary-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
