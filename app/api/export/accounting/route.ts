import { NextResponse, type NextRequest } from 'next/server';
import { listOrderAccounts } from '@/lib/accounting';
import { requireApiUser } from '@/lib/api-auth';
import { canAccessMenu } from '@/lib/auth';
import { STATUS_LABELS } from '@/lib/order-status';
import { stockListWorkbook } from '@/lib/xlsx-export';

/**
 * Exports the (optionally filtered) accounting list as an .xlsx file. Takes
 * the same q/delivery filter params as the accounting page, so the download
 * always matches what the admin sees.
 */
export async function GET(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canAccessMenu(session, '/accounting')) {
    return NextResponse.json({ error: 'دسترسی به این لیست را ندارید.' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const delivery = params.get('delivery');
  const deliveryFilter =
    delivery === 'pickup' ? 'pickup' : delivery === 'shipping' ? 'shipping' : 'all';
  const accounts = await listOrderAccounts(params.get('q')?.trim() || undefined, deliveryFilter);

  const rows = accounts.map((account) => [
    account.displayId,
    account.date,
    account.customerName,
    account.customerPhone ?? '',
    account.deliveryKind === 'pickup' ? 'حضوری' : 'ارسالی',
    account.deliveryMethodLabel,
    account.baseAmount,
    account.productDiscount,
    account.couponCode ?? '',
    account.discountAmount,
    account.payable,
    account.onlinePaid,
    account.walletPaid,
    account.refunded,
    STATUS_LABELS[account.status],
  ]);

  const buffer = await stockListWorkbook(
    'حسابداری',
    [
      'شناسه سفارش',
      'تاریخ',
      'مشتری',
      'موبایل',
      'روش تحویل',
      'روش ثبت‌شده',
      'قیمت اصلی (تومان)',
      'تخفیف کالا (تومان)',
      'کد تخفیف',
      'تخفیف کد (تومان)',
      'قابل پرداخت (تومان)',
      'پرداخت آنلاین (تومان)',
      'از کیف پول (تومان)',
      'بازگشت به کیف پول (تومان)',
      'وضعیت',
    ],
    rows
  );
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="accounting-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
