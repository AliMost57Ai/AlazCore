import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu, requireApiUser } from '@/lib/api-auth';
import { setProductCategories } from '@/lib/categories';
import {
  createProduct,
  listProducts,
  validateProductInput,
  type ProductInput,
} from '@/lib/products';
import { resolveSectionPlacements } from '@/lib/theme-settings';

/** GET /api/products — list, any signed-in user. Filters via query string. */
export async function GET(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get('search')?.trim() || undefined;
  const visibilityParam = searchParams.get('visibility');
  const visibility =
    visibilityParam === 'true' ? true : visibilityParam === 'false' ? false : undefined;

  const products = await listProducts({ search, visibility });
  return NextResponse.json({ products });
}

/** POST /api/products — create, needs the products:add grant. */
export async function POST(request: NextRequest) {
  const session = await requireApiMenu('/products', 'add');
  if (session instanceof NextResponse) {
    return session;
  }

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

  // Optional theme-section pins (بخش‌های نمایش در قالب فعال) — validated
  // against the ACTIVE theme's sections, never trusted raw.
  const placements = await resolveSectionPlacements(body.sectionIds, {}, 'sectionIds' in body);
  if (placements instanceof NextResponse) {
    return placements;
  }

  const input = body as unknown as ProductInput;
  const product = await createProduct({
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

  // Optional category assignment (گروه‌ها و دسته‌بندی کالا).
  if (Array.isArray(body.categoryIds)) {
    const ids = body.categoryIds.filter((id): id is string => typeof id === 'string');
    await setProductCategories(product.id, ids);
  }

  return NextResponse.json({ product }, { status: 201 });
}
