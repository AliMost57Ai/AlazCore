import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { cancelReturnRequest } from '@/lib/product-returns';

/**
 * POST /api/account/returns/[id]/cancel — لغو درخواست مرجوعی توسط خود مشتری،
 * فقط تا قبل از بررسی فروشگاه. مالکیت در سرویس چک می‌شود.
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await context.params;

  const result = await cancelReturnRequest(id, session.sub, session.name);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
