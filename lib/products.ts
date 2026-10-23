/**
 * Product domain logic: types, validation, and DB access.
 *
 * Server-only — imports lib/db. Pages and API routes both call these; nothing
 * here is ever shipped to the browser.
 */

import type { Prisma } from './generated/prisma/client';
import prisma from './db';
import { parseSectionPlacements, type SectionPlacements } from './section-placements';

export interface ProductProp {
  key: string;
  value: string;
}

export interface ProductVariantInput {
  name: string;
  sku?: string;
  /** Null = inherits the product price. */
  price?: number;
  qty: number;
}

export interface ProductImageInput {
  path: string;
  sortOrder: number;
}

/** Shape handed to client components — Prisma rows with props parsed. */
export interface ProductDTO {
  id: string;
  name: string;
  slug: string;
  price: number;
  /** Store-wide percent discount, 0–90 (0 = none). Applies to variants too. */
  discountPercent: number;
  qty: number;
  isVisible: boolean;
  /** نقطه سفارش — هشدار لیست خرید. */
  reorderPoint: number | null;
  /** حداقل موجودی — هشدار رو به اتمام. */
  minStock: number | null;
  /** خالی‌فروشی این کالا — فقط با مجوز پنل Core. */
  oversellAllowed: boolean;
  oversellMax: number | null;
  props: ProductProp[];
  /** Category ids the product is assigned to (join table rows). */
  categoryIds: string[];
  /** برند کالا — اختیاری؛ برای کارت، صفحه محصول و فیلتر فروشگاه. */
  brandId: string | null;
  brandName: string | null;
  brandSlug: string | null;
  /** Theme-section pins: themeId → section ids (empty map = show everywhere). */
  placements: SectionPlacements;
  variants: {
    id: string;
    name: string;
    sku: string | null;
    price: number | null;
    qty: number;
  }[];
  images: { id: string; path: string; sortOrder: number }[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  reorderPoint?: number | null;
  minStock?: number | null;
  oversellAllowed?: boolean;
  oversellMax?: number | null;
  name: string;
  slug?: string;
  price: number;
  /** Optional on input: 0–90; defaults to 0 (no discount). */
  discountPercent?: number;
  qty: number;
  isVisible: boolean;
  props: ProductProp[];
  variants: ProductVariantInput[];
  images: ProductImageInput[];
  /** Theme-section pins — only written when explicitly provided. */
  placements?: SectionPlacements;
  /** برند کالا — اختیاری؛ وجودش سمت API اعتبارسنجی می‌شود (validateBrandRef). */
  brandId?: string | null;
}

/** A product row with its relations included — what every query here returns. */
type ProductRow = Prisma.ProductGetPayload<{
  include: {
    variants: true;
    images: true;
    categories: { select: { categoryId: true } };
    brand: { select: { id: true; name: true; slug: true } };
  };
}>;

function toDTO(row: ProductRow): ProductDTO {
  let props: ProductProp[] = [];
  try {
    const parsed: unknown = JSON.parse(row.props);
    if (Array.isArray(parsed)) {
      props = parsed.filter(
        (item): item is ProductProp =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as ProductProp).key === 'string' &&
          typeof (item as ProductProp).value === 'string'
      );
    }
  } catch {
    // Malformed JSON in the column: degrade to "no props", never crash a page.
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: row.price,
    discountPercent: row.discountPercent,
    qty: row.qty,
    isVisible: row.isVisible,
    reorderPoint: row.reorderPoint,
    minStock: row.minStock,
    oversellAllowed: row.oversellAllowed,
    oversellMax: row.oversellMax,
    props,
    categoryIds: row.categories.map((join) => join.categoryId),
    brandId: row.brand?.id ?? null,
    brandName: row.brand?.name ?? null,
    brandSlug: row.brand?.slug ?? null,
    placements: parseSectionPlacements(row.placements),
    variants: row.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      qty: variant.qty,
    })),
    images: row.images.map((image) => ({
      id: image.id,
      path: image.path,
      sortOrder: image.sortOrder,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Persian digits → ASCII, then lowercase, spaces → dashes, non-slug chars dropped. */
export function slugify(name: string): string {
  const ascii = name
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .toLowerCase();

  const slug = ascii
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9؀-ۿ-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  return slug || `product-${Date.now().toString(36)}`;
}

/** Assembles a unique slug: falls back to -2, -3… when the derived one is taken. */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  // excludeId keeps a product renaming itself from colliding with its own slug.
  const taken = await prisma.product.findMany({
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

/**
 * Validates and normalises untrusted product input (from an API request body).
 * Returns a list of Persian error messages — empty means valid.
 */
export function validateProductInput(input: unknown): string[] {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null) {
    return ['داده محصول نامعتبر است.'];
  }

  const body = input as Record<string, unknown>;

  if (typeof body.name !== 'string' || body.name.trim().length < 2) {
    errors.push('نام محصول باید حداقل ۲ نویسه باشد.');
  }

  if (typeof body.price !== 'number' || !Number.isInteger(body.price) || body.price < 0) {
    errors.push('قیمت باید عددی نامنفی باشد.');
  }

  if (
    body.discountPercent !== undefined &&
    body.discountPercent !== null &&
    (typeof body.discountPercent !== 'number' ||
      !Number.isInteger(body.discountPercent) ||
      body.discountPercent < 0 ||
      body.discountPercent > 90)
  ) {
    errors.push('درصد تخفیف باید عددی بین ۰ تا ۹۰ باشد.');
  }

  if (typeof body.qty !== 'number' || !Number.isInteger(body.qty) || body.qty < 0) {
    errors.push('موجودی باید عددی نامنفی باشد.');
  }

  if (typeof body.isVisible !== 'boolean') {
    errors.push('وضعیت نمایش باید true یا false باشد.');
  }

  if (body.props !== undefined) {
    if (!Array.isArray(body.props)) {
      errors.push('ویژگی‌ها باید فهرستی باشند.');
    } else {
      body.props.forEach((prop) => {
        if (
          typeof prop !== 'object' ||
          prop === null ||
          typeof (prop as ProductProp).key !== 'string' ||
          typeof (prop as ProductProp).value !== 'string'
        ) {
          errors.push('هر ویژگی باید کلید و مقدار متنی داشته باشد.');
        }
      });
    }
  }

  if (body.variants !== undefined) {
    if (!Array.isArray(body.variants)) {
      errors.push('نوع‌ها باید فهرستی باشند.');
    } else {
      body.variants.forEach((variant) => {
        if (typeof variant !== 'object' || variant === null) {
          errors.push('هر نوع باید یک شیء باشد.');
          return;
        }
        const v = variant as Record<string, unknown>;
        if (typeof v.name !== 'string' || v.name.trim().length < 1) {
          errors.push('نام نوع نمی‌تواند خالی باشد.');
        }
        if (typeof v.qty !== 'number' || !Number.isInteger(v.qty) || v.qty < 0) {
          errors.push('موجودی نوع باید عددی نامنفی باشد.');
        }
        if (
          v.price !== undefined &&
          v.price !== null &&
          (typeof v.price !== 'number' || v.price < 0)
        ) {
          errors.push('قیمت نوع باید عددی نامنفی باشد.');
        }
      });
    }
  }

  if (body.images !== undefined) {
    if (!Array.isArray(body.images)) {
      errors.push('تصاویر باید فهرستی باشند.');
    } else {
      body.images.forEach((image) => {
        if (
          typeof image !== 'object' ||
          image === null ||
          typeof (image as ProductImageInput).path !== 'string' ||
          !(image as ProductImageInput).path.startsWith('uploads/')
        ) {
          errors.push('مسیر تصویر نامعتبر است.');
        }
      });
    }
  }

  // موجودی هوشمند — نقطه سفارش/حداقل موجودی: null یا عدد صحیح نامنفی.
  for (const field of ['reorderPoint', 'minStock'] as const) {
    const value = body[field];
    if (
      value !== undefined &&
      value !== null &&
      (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
    ) {
      errors.push('نقطه سفارش و حداقل موجودی باید عددی نامنفی یا خالی باشند.');
    }
  }

  // برند — رشته یا خالی؛ وجود رکورد سمت API با validateBrandRef چک می‌شود.
  if (
    body.brandId !== undefined &&
    body.brandId !== null &&
    body.brandId !== '' &&
    typeof body.brandId !== 'string'
  ) {
    errors.push('برند نامعتبر است.');
  }

  if (
    body.oversellMax !== undefined &&
    body.oversellMax !== null &&
    (typeof body.oversellMax !== 'number' ||
      !Number.isInteger(body.oversellMax) ||
      body.oversellMax < 1)
  ) {
    errors.push('تعداد خالی‌فروشی باید عددی بزرگ‌تر از صفر باشد.');
  }

  return errors;
}

export interface ListProductsOptions {
  /** Case-insensitive match on name/slug (ASCII or Persian). */
  search?: string;
  /** undefined = all, true = visible only, false = hidden only. */
  visibility?: boolean;
  /** Restrict to products assigned to this category (or its children). */
  categoryId?: string;
  /** Restrict to products of this brand (id — slug بیرون resolve می‌شود). */
  brandId?: string;
}

export async function listProducts(options: ListProductsOptions = {}): Promise<ProductDTO[]> {
  const { search, visibility, categoryId, brandId } = options;

  // Category filter resolves through the join table — children of a group
  // count too, so choosing «موبایل» also shows its sub-categories' products.
  let categoryProductIds: string[] | undefined;
  if (categoryId) {
    const ids = [categoryId, ...(await childCategoryIds(categoryId))];
    const joins = await prisma.productCategory.findMany({
      where: { categoryId: { in: ids } },
      select: { productId: true },
    });
    categoryProductIds = [...new Set(joins.map((join) => join.productId))];
    // No products at all → return early (an empty `in: []` would match everything).
    if (categoryProductIds.length === 0) {
      return [];
    }
  }

  const rows = await prisma.product.findMany({
    where: {
      isVisible: visibility,
      ...(categoryProductIds ? { id: { in: categoryProductIds } } : {}),
      ...(brandId ? { brandId } : {}),
      ...(search
        ? {
            OR: [{ name: { contains: search } }, { slug: { contains: search } }],
          }
        : {}),
    },
    include: {
      variants: true,
      images: { orderBy: { sortOrder: 'asc' } },
      categories: { select: { categoryId: true } },
      brand: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return rows.map(toDTO);
}

/** The direct children of a category (used to expand a group filter). */
async function childCategoryIds(categoryId: string): Promise<string[]> {
  const children = await prisma.category.findMany({
    where: { parentId: categoryId },
    select: { id: true },
  });
  return children.map((child) => child.id);
}

/** The stored theme-section placements of one product (merge base on update). */
export async function getProductPlacements(id: string): Promise<SectionPlacements> {
  const row = await prisma.product.findUnique({ where: { id }, select: { placements: true } });
  return row ? parseSectionPlacements(row.placements) : {};
}

export async function getProduct(id: string): Promise<ProductDTO | null> {
  const row = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: true,
      images: { orderBy: { sortOrder: 'asc' } },
      categories: { select: { categoryId: true } },
      brand: { select: { id: true, name: true, slug: true } },
    },
  });

  return row ? toDTO(row) : null;
}

/** Public shop lookup — only visible products are reachable by slug. */
export async function getVisibleProductBySlug(slug: string): Promise<ProductDTO | null> {
  const row = await prisma.product.findFirst({
    where: { slug, isVisible: true },
    include: {
      variants: true,
      images: { orderBy: { sortOrder: 'asc' } },
      categories: { select: { categoryId: true } },
      brand: { select: { id: true, name: true, slug: true } },
    },
  });

  return row ? toDTO(row) : null;
}

export async function countVisibleProducts(): Promise<number> {
  return prisma.product.count({ where: { isVisible: true } });
}

export async function createProduct(input: ProductInput): Promise<ProductDTO> {
  const slug = await uniqueSlug(input.slug ? slugify(input.slug) : slugify(input.name));

  const row = await prisma.product.create({
    data: {
      name: input.name.trim(),
      slug,
      price: input.price,
      discountPercent: input.discountPercent ?? 0,
      // با وجود نوع‌ها، موجودی کل محصول = جمع موجودی نوع‌ها — مقدار فرم
      // نادیده گرفته می‌شود تا کسر/برگشت ثبت سفارش همیشه هم‌گام بماند.
      qty:
        input.variants.length > 0
          ? input.variants.reduce((sum, variant) => sum + variant.qty, 0)
          : input.qty,
      isVisible: input.isVisible,
      reorderPoint: input.reorderPoint ?? null,
      minStock: input.minStock ?? null,
      oversellAllowed: input.oversellAllowed ?? false,
      oversellMax: input.oversellMax ?? null,
      props: JSON.stringify(input.props),
      ...(input.placements !== undefined ? { placements: JSON.stringify(input.placements) } : {}),
      ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
      variants: {
        create: input.variants.map((variant) => ({
          name: variant.name.trim(),
          sku: variant.sku?.trim() || null,
          price: variant.price ?? null,
          qty: variant.qty,
        })),
      },
      images: {
        create: input.images.map((image) => ({
          path: image.path,
          sortOrder: image.sortOrder,
        })),
      },
    },
    include: {
      variants: true,
      images: { orderBy: { sortOrder: 'asc' } },
      categories: { select: { categoryId: true } },
      brand: { select: { id: true, name: true, slug: true } },
    },
  });

  return toDTO(row);
}

export async function updateProduct(id: string, input: ProductInput): Promise<ProductDTO | null> {
  const existing = await prisma.product.findUnique({ where: { id }, select: { slug: true } });
  if (!existing) {
    return null;
  }

  // Slugs only change when the name (or an explicit slug) actually differs —
  // otherwise every save would churn the slug with -2, -3… suffixes.
  const desiredBase = input.slug ? slugify(input.slug) : slugify(input.name);
  const slug = desiredBase === existing.slug ? existing.slug : await uniqueSlug(desiredBase, id);

  const row = await prisma.product.update({
    where: { id },
    data: {
      name: input.name.trim(),
      slug,
      price: input.price,
      discountPercent: input.discountPercent ?? 0,
      // با وجود نوع‌ها، موجودی کل محصول = جمع موجودی نوع‌ها — مقدار فرم
      // نادیده گرفته می‌شود تا کسر/برگشت ثبت سفارش همیشه هم‌گام بماند.
      qty:
        input.variants.length > 0
          ? input.variants.reduce((sum, variant) => sum + variant.qty, 0)
          : input.qty,
      isVisible: input.isVisible,
      reorderPoint: input.reorderPoint ?? null,
      minStock: input.minStock ?? null,
      // خالی‌فروشی فقط وقتی بازنویسی می‌شود که فرستنده صریحاً فرستاده باشد —
      // ویرایشگر بدون مجوز فیلد را نمی‌فرستد و نباید تنظیم موجود پاک شود.
      ...(input.oversellAllowed !== undefined || input.oversellMax !== undefined
        ? {
            oversellAllowed: input.oversellAllowed ?? false,
            oversellMax: input.oversellMax ?? null,
          }
        : {}),
      props: JSON.stringify(input.props),
      ...(input.placements !== undefined ? { placements: JSON.stringify(input.placements) } : {}),
      ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
      variants: {
        // Full replace: the client submits the whole list, and rows carry no
        // identity worth preserving across edits.
        deleteMany: {},
        create: input.variants.map((variant) => ({
          name: variant.name.trim(),
          sku: variant.sku?.trim() || null,
          price: variant.price ?? null,
          qty: variant.qty,
        })),
      },
      images: {
        deleteMany: {},
        create: input.images.map((image) => ({
          path: image.path,
          sortOrder: image.sortOrder,
        })),
      },
    },
    include: {
      variants: true,
      images: { orderBy: { sortOrder: 'asc' } },
      categories: { select: { categoryId: true } },
      brand: { select: { id: true, name: true, slug: true } },
    },
  });

  return toDTO(row);
}

export async function deleteProduct(id: string): Promise<boolean> {
  // Cascade removes variants and images rows.
  const deleted = await prisma.product.deleteMany({ where: { id } });
  return deleted.count > 0;
}
