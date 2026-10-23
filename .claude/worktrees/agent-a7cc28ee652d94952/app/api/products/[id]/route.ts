import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu, requireApiUser } from '@/lib/api-auth';
import { getProductCategoryIds, setProductCategories } from '@/lib/categories';
import {
  deleteProduct,
  getProduct,
  getProductPlacements,
  updateProduct,
  validateProductInput,
  type ProductInput,
} from '@/lib/products';
import { resolveSectionPlacements } from '@/lib/theme-settings';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/products/:id — read, any signed-in user. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await params;
  const product = await getProduct(id);
  const categoryIds = await getProductCategoryIds(id);

  if (!product) {
    return NextResponse.json({ error: 'محصول یافت نشد.' }, { status: 404 });
  }

  return NextResponse.json({ product, categoryIds });
}

/** PATCH /api/products/:id — update (incl. visibility toggle), products:edit. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await requireApiMenu('/products', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  const errors = validateProductInput(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0], errors }, { status: 400 });
  }

  // Optional theme-section pins (بخش‌های نمایش در قالب فعال) — merged onto
  // this product's stored pins for the other themes.
  const placements = await resolveSectionPlacements(
    body.sectionIds,
    await getProductPlacements(id),
    'sectionIds' in body
  );
  if (placements instanceof NextResponse) {
    return placements;
  }

  const input = body as unknown as ProductInput;
  const product = await updateProduct(id, {
    name: input.name,
    price: input.price,
    discountPercent: input.discountPercent ?? 0,
    qty: input.qty,
    isVisible: input.isVisible,
    props: input.props ?? [],
    variants: input.variants ?? [],
    images: input.images ?? [],
    ...(placements !== null ? { placements } : {}),
  });

  if (!product) {
    return NextResponse.json({ error: 'محصول یافت نشد.' }, { status: 404 });
  }

  // Optional category re-assignment (گروه‌ها و دسته‌بندی کالا).
  if (Array.isArray(body.categoryIds)) {
    const ids = body.categoryIds.filter(
      (candidate): candidate is string => typeof candidate === 'string'
    );
    await setProductCategories(id, ids);
  }

  return NextResponse.json({ product });
}

/** DELETE /api/products/:id — needs the products:edit grant. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await requireApiMenu('/products', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  const { id } = await params;
  const deleted = await deleteProduct(id);

  if (!deleted) {
    return NextResponse.json({ error: 'محصول یافت نشد.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
