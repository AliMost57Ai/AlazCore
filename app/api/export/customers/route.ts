import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { canAccessMenu } from '@/lib/auth';
import { listCustomers } from '@/lib/customers';
import { stockListWorkbook } from '@/lib/xlsx-export';

/** Exports the customer list as an .xlsx file — same q filter as the page. */
export async function GET(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canAccessMenu(session, '/customers')) {
    return NextResponse.json({ error: 'دسترسی به این لیست را ندارید.' }, { status: 403 });
  }

  const customers = await listCustomers(request.nextUrl.searchParams.get('q')?.trim() || undefined);
  const rows = customers.map((customer) => [
    customer.name,
    customer.phone,
    customer.tier,
    customer.orders,
    customer.spent,
    customer.since,
  ]);

  const buffer = await stockListWorkbook(
    'مشتریان',
    ['نام', 'موبایل', 'سطح', 'تعداد سفارش', 'مجموع خرید (تومان)', 'تاریخ عضویت'],
    rows
  );
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="customers-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
