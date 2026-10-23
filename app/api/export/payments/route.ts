import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { canAccessMenu } from '@/lib/auth';
import { gatewayLabel, PAYMENT_KIND_LABELS, PAYMENT_STATE_LABELS } from '@/lib/payment-defs';
import { listAllOnlinePayments } from '@/lib/wallet';
import { stockListWorkbook } from '@/lib/xlsx-export';

/** Exports every online payment attempt as an .xlsx file — the /payments list. */
export async function GET() {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canAccessMenu(session, '/payments')) {
    return NextResponse.json({ error: 'دسترسی به این لیست را ندارید.' }, { status: 403 });
  }

  const payments = await listAllOnlinePayments();
  const rows = payments.map((payment) => [
    payment.date,
    payment.userName,
    payment.userPhone ?? '',
    PAYMENT_KIND_LABELS[payment.kind],
    gatewayLabel(payment.gateway),
    payment.amount,
    PAYMENT_STATE_LABELS[payment.state],
    payment.refId ?? '',
    payment.orderDisplayId ?? '',
  ]);

  const buffer = await stockListWorkbook(
    'تراکنش‌های درگاه',
    ['تاریخ', 'مشتری', 'موبایل', 'نوع', 'درگاه', 'مبلغ (تومان)', 'وضعیت', 'کد پیگیری', 'سفارش'],
    rows
  );
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="online-payments-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
