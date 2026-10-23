import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/api-auth';
import { addFavorite, listFavoriteProducts, removeFavorite } from '@/lib/favorites';

export const dynamic = 'force-dynamic';

/**
 * علاقه‌مندی‌های کاربر جاری. «چه کسی» فقط از نشست می‌آید — productId تنها
 * ورودی کلاینت است (ضد IDOR). GET فهرست کامل، POST افزودن، DELETE حذف.
 */
export async function GET() {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const products = await listFavoriteProducts(session.sub);
  return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: { productId?: unknown };
  try {
    body = (await request.json()) as { productId?: unknown };
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  if (typeof body.productId !== 'string' || body.productId.trim() === '') {
    return NextResponse.json({ error: 'شناسه کالا الزامی است.' }, { status: 400 });
  }

  const result = await addFavorite(session.sub, body.productId.trim());
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await requireApiUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const productId = request.nextUrl.searchParams.get('productId');
  if (!productId) {
    return NextResponse.json({ error: 'شناسه کالا الزامی است.' }, { status: 400 });
  }

  await removeFavorite(session.sub, productId);
  return NextResponse.json({ ok: true });
}
