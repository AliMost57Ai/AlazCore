import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { submitReturnShipment } from '@/lib/product-returns';

interface ShipBody {
  trackingCode?: unknown;
  shippingCost?: unknown;
  receiptPath?: unknown;
}

/**
 * POST /api/account/returns/[id]/ship — ثبت مدارک ارسال مرسوله برگشتی توسط
 * مشتری (روش self_ship): کد رهگیری، هزینه ارسال و عکس رسید. مالکیت درخواست
 * در خود سرویس چک می‌شود؛ id همان cuid درخواست است.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;

  let body: ShipBody;
  try {
    body = (await request.json()) as ShipBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const cost =
    typeof body.shippingCost === 'number'
      ? body.shippingCost
      : typeof body.shippingCost === 'string' && body.shippingCost.trim() !== ''
        ? Number(body.shippingCost)
        : Number.NaN;

  const result = await submitReturnShipment({
    returnId: id,
    userId: session.sub,
    userName: session.name,
    trackingCode: typeof body.trackingCode === 'string' ? body.trackingCode : '',
    shippingCost: Number.isFinite(cost) ? Math.trunc(cost) : Number.NaN,
    receiptPath: typeof body.receiptPath === 'string' ? body.receiptPath : '',
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
