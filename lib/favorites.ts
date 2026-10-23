/**
 * لیست علاقه‌مندی‌های مشتری — دامین ساده (user × product). همه‌ی خواندن/نوشتن
 * همیشه با userId نشست می‌آید؛ هیچ مسیری productId/userId را از کلاینت برای
 * «چه کسی» نمی‌پذیرد (ضد IDOR).
 *
 * Server-only — imports lib/db.
 */

import prisma from './db';
import type { ProductDTO } from './products';

/** علاقه‌مندی‌های یک کاربر به ترتیب تازه‌ترین — با DTO کامل محصول. */
export async function listFavoriteProducts(userId: string): Promise<ProductDTO[]> {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      product: {
        include: {
          variants: true,
          images: { orderBy: { sortOrder: 'asc' } },
          categories: { select: { categoryId: true } },
          brand: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
  // کالای حذف‌شدهCascade حذف شده، پس product همیشه هست؛ isVisible هم عمداً
  // فیلتر نمی‌شود — اگر مدیر کالایی را پنهان کند، مشتری در لیست خودش می‌بیند.
  return rows
    .filter((row) => row.product !== null)
    .map((row) => ({
      id: row.product.id,
      name: row.product.name,
      slug: row.product.slug,
      price: row.product.price,
      discountPercent: row.product.discountPercent,
      qty: row.product.qty,
      isVisible: row.product.isVisible,
      reorderPoint: row.product.reorderPoint,
      minStock: row.product.minStock,
      oversellAllowed: row.product.oversellAllowed,
      oversellMax: row.product.oversellMax,
      props: safeProps(row.product.props),
      categoryIds: row.product.categories.map((join) => join.categoryId),
      brandId: row.product.brand?.id ?? null,
      brandName: row.product.brand?.name ?? null,
      brandSlug: row.product.brand?.slug ?? null,
      placements: {},
      variants: row.product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        price: variant.price,
        qty: variant.qty,
      })),
      images: row.product.images.map((image) => ({
        id: image.id,
        path: image.path,
        sortOrder: image.sortOrder,
      })),
      createdAt: row.product.createdAt.toISOString(),
      updatedAt: row.product.updatedAt.toISOString(),
    }));
}

/** شناسه‌های علاقه‌مندی کاربر — برای حالت اولیه قلب‌های ویترین. */
export async function getFavoriteIds(userId: string): Promise<string[]> {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: { productId: true },
  });
  return rows.map((row) => row.productId);
}

/** افزودن علاقه‌مندی — idempotent؛ وجود کالا چک می‌شود. */
export async function addFavorite(
  userId: string,
  productId: string
): Promise<{ ok: true } | { error: string }> {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) {
    return { error: 'کالا یافت نشد.' };
  }
  await prisma.favorite.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: {},
  });
  return { ok: true };
}

/** حذف علاقه‌مندی — idempotent. */
export async function removeFavorite(userId: string, productId: string): Promise<void> {
  await prisma.favorite.deleteMany({ where: { userId, productId } });
}

function safeProps(raw: string): { key: string; value: string }[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is { key: string; value: string } =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as { key?: unknown }).key === 'string' &&
        typeof (item as { value?: unknown }).value === 'string'
    );
  } catch {
    return [];
  }
}
