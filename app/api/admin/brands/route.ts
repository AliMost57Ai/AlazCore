import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import {
  createBrand,
  deleteBrand,
  listBrands,
  updateBrand,
  type BrandInput,
} from '@/lib/brands';

/** GET — فهرست برندها برای پنل (غیرفعال‌ها هم، تا مدیریت شوند). */
export async function GET() {
  const session = await requireApiMenu('/brands');
  if (session instanceof NextResponse) {
    return session;
  }

  return NextResponse.json({ brands: await listBrands() });
}

interface BrandBody {
  id?: unknown;
  name?: unknown;
  logoPath?: unknown;
  isActive?: unknown;
}

/** Creates (id absent) or updates (id present) one brand. */
export async function POST(request: NextRequest) {
  let body: BrandBody;
  try {
    body = (await request.json()) as BrandBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const updateId = typeof body.id === 'string' && body.id.trim() !== '' ? body.id.trim() : null;

  // Creating needs the add grant, changing an existing row the edit one.
  const session = await requireApiMenu('/brands', updateId ? 'edit' : 'add');
  if (session instanceof NextResponse) {
    return session;
  }

  const input: BrandInput = {
    name: typeof body.name === 'string' ? body.name : '',
    ...(body.logoPath !== undefined
      ? { logoPath: typeof body.logoPath === 'string' && body.logoPath ? body.logoPath : null }
      : {}),
    ...(body.isActive !== undefined ? { isActive: body.isActive === true } : {}),
  };

  const result = updateId ? await updateBrand(updateId, input) : await createBrand(input);

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, brand: result.brand });
}

/** Deletes one brand — رد می‌شود اگر محصولات هنوز به آن وصال‌اند. */
export async function DELETE(request: NextRequest) {
  const session = await requireApiMenu('/brands', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'شناسه برند الزامی است.' }, { status: 400 });
  }

  const result = await deleteBrand(id);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
