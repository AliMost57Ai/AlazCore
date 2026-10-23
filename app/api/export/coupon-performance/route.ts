import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { canAccessMenu } from '@/lib/auth';
import { couponReport } from '@/lib/financial-reports';
import { stockListWorkbook } from '@/lib/xlsx-export';

const STATUS_LABELS = {
  active: 'فعال',
  expired: 'منقضی',
  inactive: 'غیرفعال',
  deleted: 'حذف‌شده',
} as const;

function statusLabel(row: { isActive: boolean | null; isExpired: boolean }): string {
  if (row.isActive === null) {
    return STATUS_LABELS.deleted;
  }
  if (row.isExpired) {
    return STATUS_LABELS.expired;
  }
  return row.isActive ? STATUS_LABELS.active : STATUS_LABELS.inactive;
}

/**
 * خروجی اکسل عملکرد کدهای تخفیف — همان فیلتر بازه صفحه، با سطر جمع کل.
 */
export async function GET(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canAccessMenu(session, '/reports/coupons')) {
    return NextResponse.json({ error: 'دسترسی به این گزارش را ندارید.' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const { rows, totals } = await couponReport({
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  });

  const dataRows = rows.map((row) => [
    row.code,
    statusLabel(row),
    row.uses,
    row.orders,
    row.customers,
    row.sales,
    row.discount,
    row.share,
    row.lastUsed ?? '',
  ]);
  dataRows.push([
    'جمع کل',
    '',
    rows.reduce((sum, row) => sum + row.uses, 0),
    totals.orders,
    '',
    totals.sales,
    totals.discount,
    '',
    '',
  ]);

  const buffer = await stockListWorkbook(
    'عملکرد کدهای تخفیف',
    [
      'کد تخفیف',
      'وضعیت',
      'استفاده (نفر)',
      'سفارش',
      'مشتری یکتا',
      'فروش با تخفیف (تومان)',
      'تخفیف داده‌شده (تومان)',
      'سهم تخفیف (٪)',
      'آخرین استفاده',
    ],
    dataRows
  );
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="coupon-performance-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
