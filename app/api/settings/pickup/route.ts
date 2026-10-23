import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import {
  deletePickupLocation,
  listPickupHolidays,
  listPickupLocations,
  savePickupLocation,
  type PickupLocationInput,
  type PickupSlotInput,
} from '@/lib/pickup';

/**
 * CRUD نقاط تحویل حضوری (+ روزهای تعطیل در GET) — دسترسی /settings/pickup:
 * GET نیاز به view، POST (ساخت/ویرایش) add|edit و DELETE نیاز به edit دارد.
 */

export async function GET() {
  const session = await requireApiMenu('/settings/pickup');
  if (session instanceof NextResponse) {
    return session;
  }
  const [locations, holidays] = await Promise.all([listPickupLocations(), listPickupHolidays()]);
  return NextResponse.json({ locations, holidays });
}

interface PickupSlotBody {
  startMinute?: unknown;
  endMinute?: unknown;
  capacity?: unknown;
}

interface PickupLocationBody {
  id?: unknown;
  title?: unknown;
  address?: unknown;
  lat?: unknown;
  lng?: unknown;
  isActive?: unknown;
  slots?: unknown;
}

/** هر ورودی نامعتبر = null (کل POST رد می‌شود). */
function parseInput(body: PickupLocationBody): PickupLocationInput | null {
  if (typeof body.title !== 'string' || typeof body.address !== 'string') {
    return null;
  }
  if (typeof body.isActive !== 'boolean' || !Array.isArray(body.slots)) {
    return null;
  }
  const lat =
    typeof body.lat === 'number' && Number.isFinite(body.lat)
      ? body.lat
      : body.lat === null
        ? null
        : undefined;
  const lng =
    typeof body.lng === 'number' && Number.isFinite(body.lng)
      ? body.lng
      : body.lng === null
        ? null
        : undefined;

  const slots: PickupSlotInput[] = [];
  for (const raw of body.slots) {
    if (raw === null || typeof raw !== 'object') {
      return null;
    }
    const slot = raw as PickupSlotBody;
    if (
      typeof slot.startMinute !== 'number' ||
      typeof slot.endMinute !== 'number' ||
      typeof slot.capacity !== 'number'
    ) {
      return null;
    }
    slots.push({
      startMinute: slot.startMinute,
      endMinute: slot.endMinute,
      capacity: slot.capacity,
    });
  }

  return {
    title: body.title,
    address: body.address,
    lat: lat === undefined ? null : lat,
    lng: lng === undefined ? null : lng,
    isActive: body.isActive,
    slots,
  };
}

/** ساخت (id خالی) یا ویرایش (id موجود) یک نقطه با بازه‌هایش. */
export async function POST(request: NextRequest) {
  const session = await requireApiMenu('/settings/pickup', ['add', 'edit']);
  if (session instanceof NextResponse) {
    return session;
  }

  let body: PickupLocationBody;
  try {
    body = (await request.json()) as PickupLocationBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const input = parseInput(body);
  if (!input) {
    return NextResponse.json({ error: 'فیلدهای نقطه تحویل نامعتبر است.' }, { status: 400 });
  }

  const updateId = typeof body.id === 'string' && body.id.trim() !== '' ? body.id.trim() : null;
  const result = await savePickupLocation(updateId, input);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, location: result.location });
}

export async function DELETE(request: NextRequest) {
  const session = await requireApiMenu('/settings/pickup', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'شناسه نقطه تحویل الزامی است.' }, { status: 400 });
  }

  const result = await deletePickupLocation(id);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
