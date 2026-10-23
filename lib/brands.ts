/**
 * Brand domain logic — mirror of lib/categories.ts conventions: slug derived
 * with the shared slugify, -2/-3 suffix on collision, Persian validation
 * errors, and the «در حال استفاده» delete rule (a brand with products cannot
 * be deleted — it must be deactivated instead).
 *
 * Server-only — imports lib/db.
 */

import prisma from './db';
import { slugify } from './products';

export interface BrandDTO {
  id: string;
  name: string;
  slug: string;
  /** مسیر نسبی لوگو (uploads/…) — null = بدون لوگو. */
  logoPath: string | null;
  /** برند غیرفعال از ویترین و فیلتر حذف می‌شود ولی محصولاتش سرجایش‌اند. */
  isActive: boolean;
  productCount: number;
}

/** Flat DTO for Select inputs (product form, coupon forms). */
export interface BrandOption {
  id: string;
  label: string;
}

/** chip فروشگاهی — لینک /?brand=slug. */
export interface BrandChip {
  id: string;
  name: string;
  slug: string;
}

export interface BrandInput {
  name: string;
  logoPath?: string | null;
  isActive?: boolean;
}

/** Assembles a unique slug: falls back to -2, -3… when the derived one is taken. */
async function uniqueBrandSlug(base: string, excludeId?: string): Promise<string> {
  const taken = await prisma.brand.findMany({
    where: { slug: { startsWith: base }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { slug: true },
  });
  const used = new Set(taken.map((row) => row.slug));

  if (!used.has(base)) {
    return base;
  }
  for (let i = 2; ; i += 1) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
}

type BrandRow = {
  id: string;
  name: string;
  slug: string;
  logoPath: string | null;
  isActive: boolean;
  _count: { products: number };
};

function toDTO(row: BrandRow): BrandDTO {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoPath: row.logoPath,
    isActive: row.isActive,
    productCount: row._count.products,
  };
}

const BRAND_INCLUDE = { _count: { select: { products: true } } } as const;

/** همه برندها برای پنل — غیرفعال‌ها هم می‌آیند تا مدیریت شوند. */
export async function listBrands(): Promise<BrandDTO[]> {
  const rows = await prisma.brand.findMany({
    include: BRAND_INCLUDE,
    orderBy: { name: 'asc' },
  });
  return rows.map(toDTO);
}

/** برندهای فعال برای ویترین (کروسل برند دیجی‌مارکت و آینده). */
export async function listActiveBrandChips(): Promise<BrandChip[]> {
  const rows = await prisma.brand.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
  return rows;
}

/** Flat list for the product form's Select. */
export async function listBrandOptions(): Promise<BrandOption[]> {
  const rows = await prisma.brand.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return rows.map((row) => ({ id: row.id, label: row.name }));
}

/** One brand (guarded fetch for the edit page/API). */
export async function getBrand(id: string): Promise<BrandDTO | null> {
  const row = await prisma.brand.findUnique({ where: { id }, include: BRAND_INCLUDE });
  return row ? toDTO(row) : null;
}

/** Resolve a storefront brand filter — slug → active brand id, else null. */
export async function getActiveBrandIdBySlug(slug: string): Promise<string | null> {
  const row = await prisma.brand.findUnique({
    where: { slug },
    select: { id: true, isActive: true },
  });
  return row?.isActive ? row.id : null;
}

/** Validate a client-supplied brandId (null = پاک‌کردن برند) — Persian error or null. */
export async function validateBrandRef(
  brandId: unknown
): Promise<{ brandId: string | null } | { error: string }> {
  if (brandId === undefined || brandId === null || brandId === '') {
    return { brandId: null };
  }
  if (typeof brandId !== 'string') {
    return { error: 'برند نامعتبر است.' };
  }
  const exists = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } });
  if (!exists) {
    return { error: 'برند انتخاب‌شده یافت نشد.' };
  }
  return { brandId };
}

/** Creates a brand. */
export async function createBrand(
  input: BrandInput
): Promise<{ brand: BrandDTO } | { error: string }> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    return { error: 'نام برند باید بین ۲ تا ۶۰ نویسه باشد.' };
  }

  const row = await prisma.brand.create({
    data: {
      name,
      slug: await uniqueBrandSlug(slugify(name)),
      logoPath: input.logoPath ?? null,
      isActive: input.isActive ?? true,
    },
    include: BRAND_INCLUDE,
  });

  return { brand: toDTO(row) };
}

/** Renames/re-logos a brand. */
export async function updateBrand(
  id: string,
  input: BrandInput
): Promise<{ brand: BrandDTO } | { error: string }> {
  const existing = await prisma.brand.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!existing) {
    return { error: 'برند یافت نشد.' };
  }

  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    return { error: 'نام برند باید بین ۲ تا ۶۰ نویسه باشد.' };
  }

  const slug =
    slugify(name) === existing.slug ? existing.slug : await uniqueBrandSlug(slugify(name), id);

  const row = await prisma.brand.update({
    where: { id },
    data: {
      name,
      slug,
      ...(input.logoPath !== undefined ? { logoPath: input.logoPath } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: BRAND_INCLUDE,
  });

  return { brand: toDTO(row) };
}

/**
 * Deletes a brand; refuses while products still reference it — قاعده «در حال
 * استفاده»: غیرفعال‌سازی جای حذف است تا تاریخچه سفارش‌ها بی‌برند نشود.
 */
export async function deleteBrand(id: string): Promise<{ ok: true } | { error: string }> {
  const existing = await prisma.brand.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!existing) {
    return { error: 'برند یافت نشد.' };
  }
  if (existing._count.products > 0) {
    return {
      error: `این برند روی ${existing._count.products} محصول در حال استفاده است — به‌جای حذف، آن را غیرفعال کنید.`,
    };
  }

  await prisma.brand.delete({ where: { id } });
  return { ok: true };
}
