import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAdmin } from '@/lib/api-auth';
import {
  createShippingMethod,
  deleteShippingMethod,
  listShippingMethods,
  updateShippingMethod,
  type ShippingMethodInput,
} from '@/lib/shipping';

/** All shipping methods (روش‌های ارسال) — powers the admin manager's list
 *  and mutations. */
export async function GET() {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  return NextResponse.json({ methods: await listShippingMethods() });
}

interface ShippingMethodBody {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  minDeliveryDays?: unknown;
  minShippingCost?: unknown;
  isInvoiced?: unknown;
  isActive?: unknown;
}

/** Parses the shared input shape, or null when a field has the wrong type. */
function parseInput(body: ShippingMethodBody): ShippingMethodInput | null {
  if (typeof body.name !== 'string') {
    return null;
  }
  if (typeof body.description !== 'string') {
    return null;
  }
  if (typeof body.minDeliveryDays !== 'number') {
    return null;
  }
  if (typeof body.minShippingCost !== 'number') {
    return null;
  }
  if (typeof body.isInvoiced !== 'boolean') {
    return null;
  }
  if (typeof body.isActive !== 'boolean') {
    return null;
  }

  return {
    name: body.name,
    description: body.description,
    minDeliveryDays: body.minDeliveryDays,
    minShippingCost: body.minShippingCost,
    isInvoiced: body.isInvoiced,
    isActive: body.isActive,
  };
}

/** Creates (id absent) or updates (id present) one shipping method. */
export async function POST(request: NextRequest) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: ShippingMethodBody;
  try {
    body = (await request.json()) as ShippingMethodBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const input = parseInput(body);
  if (!input) {
    return NextResponse.json({ error: 'فیلدهای روش ارسال نامعتبر است.' }, { status: 400 });
  }

  const updateId = typeof body.id === 'string' && body.id.trim() !== '' ? body.id.trim() : null;
  const result = updateId
    ? await updateShippingMethod(updateId, input)
    : await createShippingMethod(input);

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, method: result.method });
}

/** Deletes one shipping method. */
export async function DELETE(request: NextRequest) {
  const session = await requireApiAdmin();
  if (session instanceof NextResponse) {
    return session;
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'شناسه روش ارسال الزامی است.' }, { status: 400 });
  }

  const result = await deleteShippingMethod(id);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
