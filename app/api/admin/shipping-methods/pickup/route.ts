import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAdmin } from '@/lib/api-auth';
import { isInPersonDeliveryEnabled } from '@/lib/core-license';
import { setPickupShippingMethod } from '@/lib/shipping';

/**
 * فعال/غیرفعال‌کردن تحویل حضوری به‌عنوان روش ارسال برای یک نقطه — همان
 * الگوی دسترسی API روش‌های ارسال (admin؛ ادمین‌های واگذارشده از منو رد می‌شوند).
 */
export async function POST(request: NextRequest) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!(await isInPersonDeliveryEnabled())) {
    return NextResponse.json({ error: 'تحویل حضوری فعال نیست.' }, { status: 403 });
  }

  let body: { locationId?: unknown; isActive?: unknown };
  try {
    body = (await request.json()) as { locationId?: unknown; isActive?: unknown };
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  if (typeof body.locationId !== 'string' || typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'فیلدهای درخواست نامعتبر است.' }, { status: 400 });
  }

  const result = await setPickupShippingMethod(body.locationId, body.isActive);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
