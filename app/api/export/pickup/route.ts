import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { canAccessMenu } from '@/lib/auth';
import { isInPersonDeliveryEnabled } from '@/lib/core-license';
import { STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import { pickupOrdersList, type PickupOrderFilter } from '@/lib/pickup';
import { stockListWorkbook } from '@/lib/xlsx-export';

const FILTERS: PickupOrderFilter[] = ['all', 'today', 'upcoming', 'delivered'];

function isFilter(value: string | undefined): value is PickupOrderFilter {
  return FILTERS.includes(value as PickupOrderFilter);
}

function statusLabel(status: string): string {
  const known: OrderStatus[] = [
    'paid',
    'pending',
    'boxing',
    'posted',
    'shipped',
    'delivered',
    'cancelled',
  ];
  return known.includes(status as OrderStatus) ? STATUS_LABELS[status as OrderStatus] : status;
}

/**
 * Exports the (optionally filtered) in-person pickup list as an .xlsx file —
 * the same filters as /orders/pickup. آفلاین شدن فیچر در Core یعنی خروجی هم
 * در دسترس نیست.
 */
export async function GET(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canAccessMenu(session, '/orders/pickup')) {
    return NextResponse.json({ error: 'دسترسی به این لیست را ندارید.' }, { status: 403 });
  }
  if (!(await isInPersonDeliveryEnabled())) {
    return NextResponse.json({ error: 'تحویل حضوری فعال نیست.' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const rawFilter = params.get('filter') ?? undefined;
  const filter: PickupOrderFilter = isFilter(rawFilter) ? rawFilter : 'all';
  const orders = await pickupOrdersList(
    filter,
    params.get('q')?.trim() || undefined,
    params.get('date') || undefined
  );

  const rows = orders.map((order) => [
    order.displayId,
    order.customer,
    order.customerPhone ?? '',
    order.locationTitle,
    order.pickupDateLabel,
    order.slotLabel,
    order.amount,
    statusLabel(order.status),
    order.changeNote ? `${order.changeAt ?? ''} ${order.changeNote}`.trim() : '',
  ]);

  const buffer = await stockListWorkbook(
    'تحویل حضوری',
    [
      'شناسه سفارش',
      'مشتری',
      'موبایل',
      'نقطه تحویل',
      'روز تحویل',
      'بازه زمانی',
      'مبلغ (تومان)',
      'وضعیت',
      'آخرین تغییر برنامه',
    ],
    rows
  );
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="pickup-orders-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
