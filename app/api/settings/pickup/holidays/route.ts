import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import { addPickupHoliday, removePickupHoliday } from '@/lib/pickup';

/** روزهای تعطیل تحویل حضوری — افزودن و حذف؛ دسترسی /settings/pickup. */

interface HolidayBody {
  date?: unknown;
  title?: unknown;
}

export async function POST(request: NextRequest) {
  const session = await requireApiMenu('/settings/pickup', ['add', 'edit']);
  if (session instanceof NextResponse) {
    return session;
  }

  let body: HolidayBody;
  try {
    body = (await request.json()) as HolidayBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  if (typeof body.date !== 'string') {
    return NextResponse.json({ error: 'تاریخ تعطیل الزامی است.' }, { status: 400 });
  }

  const result = await addPickupHoliday(
    body.date,
    typeof body.title === 'string' ? body.title : ''
  );
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, holiday: result.holiday });
}

export async function DELETE(request: NextRequest) {
  const session = await requireApiMenu('/settings/pickup', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'شناسه روز تعطیل الزامی است.' }, { status: 400 });
  }

  const result = await removePickupHoliday(id);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
