import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { isInPersonDeliveryEnabled } from '@/lib/core-license';
import { pickupAvailability } from '@/lib/pickup';

/**
 * دسترس‌پذیری تحویل حضوری یک نقطه برای چک‌اوت مشتری — ۷ روز آینده با ظرفیت
 * بازه‌ها. فیچر خاموش در Core = پاسخ 403 تا UI هم هرگز داده نبیند.
 */
export async function GET(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!(await isInPersonDeliveryEnabled())) {
    return NextResponse.json({ error: 'تحویل حضوری فعال نیست.' }, { status: 403 });
  }

  const locationId = request.nextUrl.searchParams.get('locationId') ?? '';
  if (!locationId) {
    return NextResponse.json({ error: 'شناسه نقطه تحویل الزامی است.' }, { status: 400 });
  }

  const result = await pickupAvailability(locationId, 7);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ days: result.days });
}
