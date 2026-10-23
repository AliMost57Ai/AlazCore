import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { canAccessMenu } from '@/lib/auth';
import { listCoupons } from '@/lib/coupons';
import { faJalaliDate } from '@/lib/format';
import { stockListWorkbook } from '@/lib/xlsx-export';

/** Exports the coupon list as an .xlsx file — the /coupons list as-is. */
export async function GET() {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canAccessMenu(session, '/coupons')) {
    return NextResponse.json({ error: 'دسترسی به این لیست را ندارید.' }, { status: 403 });
  }

  const coupons = await listCoupons();
  const rows = coupons.map((coupon) => [
    coupon.code,
    coupon.type === 'percent' ? 'درصدی' : 'مبلغی',
    coupon.value,
    coupon.isActive ? 'فعال' : 'غیرفعال',
    coupon.usedCount,
    coupon.maxUses ?? '',
    coupon.expiresAt ? faJalaliDate(new Date(coupon.expiresAt)) : '',
    coupon.customerName ?? '',
    coupon.productName ?? '',
    coupon.categoryName ?? '',
    coupon.minPurchaseAmount ?? '',
  ]);

  const buffer = await stockListWorkbook(
    'کد تخفیف‌ها',
    [
      'کد',
      'نوع',
      'مقدار',
      'وضعیت',
      'استفاده‌شده',
      'سقف استفاده',
      'انقضا',
      'مشتری اختصاصی',
      'محصول',
      'دسته',
      'حداقل خرید (تومان)',
    ],
    rows
  );
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="coupons-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
