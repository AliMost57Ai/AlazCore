import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { createReturnRequest } from '@/lib/product-returns';

interface CreateReturnItem {
  productId?: unknown;
  variantId?: unknown;
  qty?: unknown;
}

interface CreateReturnBody {
  orderId?: unknown;
  reasonKind?: unknown;
  reason?: unknown;
  images?: unknown;
  items?: unknown;
}

/**
 * POST /api/account/returns — ثبت درخواست مرجوعی توسط مشتریِ واردشده.
 * سقف تعداد، مبلغ و اهلیت همه سمت سرور در lib/product-returns.ts چک می‌شود؛
 * کلاینت فقط شناسه سفارش، اقلام انتخابی، علت و مسیر عکس‌های آپلودشده می‌فرستد.
 */
export async function POST(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: CreateReturnBody;
  try {
    body = (await request.json()) as CreateReturnBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  if (typeof body.orderId !== 'string' || body.orderId === '') {
    return NextResponse.json({ error: 'سفارش انتخاب نشده است.' }, { status: 400 });
  }

  // کلاینت فقط شناسه قلم و تعداد می‌فرستد؛ هر چیز دیگر در سرویس اعتبارسنجی می‌شود.
  const items = (Array.isArray(body.items) ? body.items : [])
    .filter((item): item is CreateReturnItem => typeof item === 'object' && item !== null)
    .map((item) => ({
      productId: typeof item.productId === 'string' ? item.productId : '',
      variantId:
        typeof item.variantId === 'string' && item.variantId !== '' ? item.variantId : null,
      qty: typeof item.qty === 'number' ? item.qty : Number.NaN,
    }));

  const result = await createReturnRequest({
    userId: session.sub,
    userName: session.name,
    orderId: body.orderId,
    reasonKind: typeof body.reasonKind === 'string' ? body.reasonKind : '',
    reason: typeof body.reason === 'string' ? body.reason : '',
    images: Array.isArray(body.images) ? body.images : [],
    items,
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    { ok: true, displayId: result.displayId, refundAmount: result.refundAmount },
    { status: 201 }
  );
}
