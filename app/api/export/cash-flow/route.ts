import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { canAccessMenu } from '@/lib/auth';
import { cashFlowReport } from '@/lib/financial-reports';
import { stockListWorkbook } from '@/lib/xlsx-export';

/**
 * خروجی اکسل جریان نقدی روزانه — سطرهای روز + جمع کل.
 */
export async function GET(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canAccessMenu(session, '/reports/cash-flow')) {
    return NextResponse.json({ error: 'دسترسی به این گزارش را ندارید.' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const { rows, totals } = await cashFlowReport({
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  });

  const dataRows = rows.map((row) => [
    row.label,
    row.gatewayOrders,
    row.gatewayTopUp,
    row.walletPaid,
    row.walletRefund,
    row.walletAdjust,
    row.cashIn,
  ]);
  dataRows.push([
    'جمع کل',
    totals.gatewayOrders,
    totals.gatewayTopUp,
    totals.walletPaid,
    totals.walletRefund,
    totals.walletAdjust,
    totals.cashIn,
  ]);

  const buffer = await stockListWorkbook(
    'جریان نقدی روزانه',
    [
      'روز',
      'دریافت برای سفارش (تومان)',
      'شارژ کیف پول (تومان)',
      'پرداخت با کیف پول (تومان)',
      'بازگشت به کیف پول (تومان)',
      'تنظیم ادمین (تومان)',
      'جمع ورودی نقدی (تومان)',
    ],
    dataRows
  );
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="cash-flow-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
