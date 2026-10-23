import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { canAccessMenu } from '@/lib/auth';
import { commissionReport } from '@/lib/financial-reports';
import { stockListWorkbook } from '@/lib/xlsx-export';

/**
 * خروجی اکسل کارمزد AlazCore — سطرهای ماهانه + جمع کل.
 */
export async function GET(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canAccessMenu(session, '/reports/commission')) {
    return NextResponse.json({ error: 'دسترسی به این گزارش را ندارید.' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const { rows, totals, percent } = await commissionReport({
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  });

  const dataRows = rows.map((row) => [
    row.label,
    row.orders,
    row.sales,
    row.commission,
    row.ownerNet,
  ]);
  dataRows.push(['جمع کل', totals.orders, totals.sales, totals.commission, totals.ownerNet]);

  const buffer = await stockListWorkbook(
    percent !== null ? `کارمزد AlazCore (${percent}٪)` : 'کارمزد AlazCore',
    ['ماه', 'سفارش‌ها', 'فروش مشمول (تومان)', 'کارمزد (تومان)', 'خالص مالک (تومان)'],
    dataRows
  );
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="commission-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
