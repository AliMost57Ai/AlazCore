import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import prisma from '@/lib/db';
import { receiveReturn, reviewReturnRequest, settleReturn } from '@/lib/product-returns';

interface ReturnActionBody {
  action?: unknown;
  // approve
  returnMethod?: unknown;
  shippingPayer?: unknown;
  approvalNote?: unknown;
  // reject
  rejectReason?: unknown;
  // settle
  approvedShippingCost?: unknown;
  /** بازگشت جزئی — مبلغ نهایی واریزی (سرور به بازهٔ مجاز clamp می‌کند). */
  refundAmount?: unknown;
}

/**
 * Admin/staff review flow on a return request, addressed by its human-facing
 * displayId (RET-xxxxx) like the orders API:
 *
 *  POST { action: 'approve', returnMethod, shippingPayer, approvalNote }
 *      → status becomes 'approved' — سفارش تحویل حضوری همیشه in_person است
 *        و گزینه پیک مرجوعی فقط با فعال‌بودن تنظیمات فروشگاه.
 *  POST { action: 'reject', rejectReason }  → status becomes 'rejected'
 *  POST { action: 'receive' }               → 'approved'/'sent' → 'received'
 *  POST { action: 'settle', approvedShippingCost? }
 *      → 'received' → 'refunded' + واریز به کیف پول + بازگشت موجودی
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiMenu('/returns', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;

  let body: ReturnActionBody;
  try {
    body = (await request.json()) as ReturnActionBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const row = await prisma.returnRequest.findUnique({ where: { displayId: id } });
  if (!row) {
    return NextResponse.json({ error: 'درخواست مرجوعی یافت نشد.' }, { status: 404 });
  }

  const action = typeof body.action === 'string' ? body.action : '';

  if (action === 'approve' || action === 'reject') {
    const result = await reviewReturnRequest({
      returnId: row.id,
      staffName: session.name,
      action,
      returnMethod: typeof body.returnMethod === 'string' ? body.returnMethod : undefined,
      shippingPayer: typeof body.shippingPayer === 'string' ? body.shippingPayer : undefined,
      approvalNote: typeof body.approvalNote === 'string' ? body.approvalNote : undefined,
      rejectReason: typeof body.rejectReason === 'string' ? body.rejectReason : undefined,
    });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'receive') {
    const result = await receiveReturn(row.id, session.name);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'settle') {
    const rawCost = body.approvedShippingCost;
    const approvedShippingCost =
      typeof rawCost === 'number'
        ? rawCost
        : typeof rawCost === 'string' && rawCost.trim() !== ''
          ? Number(rawCost)
          : null;
    const rawRefund = body.refundAmount;
    const refundAmount =
      typeof rawRefund === 'number'
        ? rawRefund
        : typeof rawRefund === 'string' && rawRefund.trim() !== ''
          ? Number(rawRefund)
          : null;
    const result = await settleReturn({
      returnId: row.id,
      staffName: session.name,
      approvedShippingCost:
        approvedShippingCost != null && Number.isFinite(approvedShippingCost)
          ? Math.trunc(approvedShippingCost)
          : null,
      refundAmount:
        refundAmount != null && Number.isFinite(refundAmount) ? Math.trunc(refundAmount) : null,
    });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, refunded: result.refunded });
  }

  return NextResponse.json({ error: 'عملیات نامعتبر است.' }, { status: 400 });
}
