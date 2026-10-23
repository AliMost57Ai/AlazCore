/**
 * Product group/category domain logic (Batch K point 3).
 *
 * A root category (parent = null) is a GROUP; its children are categories.
 * Products are attached to categories through the ProductCategory join, so
 * a product can live in several categories at once.
 *
 * Server-only — imports lib/db.
 */

import prisma from './db';
import { slugify } from './products';
import { parseSectionPlacements, type SectionPlacements } from './section-placements';

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  /** Number of products directly in this category. */
  productCount: number;
  children: CategoryDTO[];
  /** Theme-section pins: themeId → section ids (empty map = show everywhere). */
  placements: SectionPlacements;
}

/** Flat DTO for Select inputs (admin forms, coupon targeting). */
export interface CategoryOption {
  id: string;
  label: string;
}

export interface CategoryInput {
  name: string;
  parentId?: string | null;
  /** Theme-section pins — only written when explicitly provided. */
  placements?: SectionPlacements;
}

/** Assembles a unique slug: falls back to -2, -3… when the derived one is taken. */
async function uniqueCategorySlug(base: string, excludeId?: string): Promise<string> {
  const taken = await prisma.category.findMany({
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

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  placements: string;
  _count: { products: number };
};

function toNested(rows: CategoryRow[]): CategoryDTO[] {
  const byParent = new Map<string | null, CategoryRow[]>();
  for (const row of rows) {
    const list = byParent.get(row.parentId) ?? [];
    list.push(row);
    byParent.set(row.parentId, list);
  }
  const build = (parentId: string | null): CategoryDTO[] =>
    (byParent.get(parentId) ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      parentId: row.parentId,
      productCount: row._count.products,
      children: build(row.id),
      placements: parseSectionPlacements(row.placements),
    }));
  return build(null);
}

/**
 * The whole category tree (groups with nested categories), sorted by name
 * within each level — the admin page and storefront filters both consume it.
 */
export async function listCategories(): Promise<CategoryDTO[]> {
  const rows = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  });
  return toNested(rows);
}

/** Flat list as «گروه › دسته» labels — for Select options. */
export async function listCategoryOptions(): Promise<CategoryOption[]> {
  const rows = await prisma.category.findMany({
    include: { parent: { select: { name: true } } },
    orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.parent ? `${row.parent.name} › ${row.name}` : `${row.name} (گروه)`,
  }));
}

/** Alias kept for callers that mean "options for a form select". */
export const getCategoryOptions = listCategoryOptions;

/** The stored theme-section placements of one category (merge base on update). */
export async function getCategoryPlacements(id: string): Promise<SectionPlacements> {
  const row = await prisma.category.findUnique({ where: { id }, select: { placements: true } });
  return row ? parseSectionPlacements(row.placements) : {};
}

/** One category (guarded fetch for the API routes). */
export async function getCategory(id: string): Promise<CategoryDTO | null> {
  const row = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  return row
    ? {
        id: row.id,
        name: row.name,
        slug: row.slug,
        parentId: row.parentId,
        productCount: row._count.products,
        children: [],
        placements: parseSectionPlacements(row.placements),
      }
    : null;
}

/**
 * Creates a category. parentId = null makes it a group; the parent must
 * itself be a root (groups only nest one level: group → categories).
 * Returns a Persian error when validation fails.
 */
export async function createCategory(
  input: CategoryInput
): Promise<{ category: CategoryDTO } | { error: string }> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    return { error: 'نام دسته باید بین ۲ تا ۶۰ نویسه باشد.' };
  }

  if (input.parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: input.parentId },
      select: { parentId: true },
    });
    if (!parent) {
      return { error: 'گروه والد یافت نشد.' };
    }
    if (parent.parentId !== null) {
      return { error: 'ساختار دسته‌ها فقط دو سطح است: گروه ← دسته.' };
    }
  }

  const slug = await uniqueCategorySlug(slugify(name));
  const row = await prisma.category.create({
    data: {
      name,
      slug,
      parentId: input.parentId ?? null,
      ...(input.placements !== undefined ? { placements: JSON.stringify(input.placements) } : {}),
    },
    include: { _count: { select: { products: true } } },
  });

  return {
    category: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      parentId: row.parentId,
      productCount: row._count.products,
      children: [],
      placements: parseSectionPlacements(row.placements),
    },
  };
}

/**
 * Renames a category (and/or moves it). A category with children or
 * assigned products cannot become a child — moves are group-level only.
 */
export async function updateCategory(
  id: string,
  input: CategoryInput
): Promise<{ category: CategoryDTO } | { error: string }> {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!existing) {
    return { error: 'دسته یافت نشد.' };
  }

  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    return { error: 'نام دسته باید بین ۲ تا ۶۰ نویسه باشد.' };
  }

  if (input.parentId !== undefined && input.parentId !== null) {
    if (input.parentId === id) {
      return { error: 'دسته نمی‌تواند والد خودش باشد.' };
    }
    const parent = await prisma.category.findUnique({
      where: { id: input.parentId },
      select: { parentId: true },
    });
    if (!parent) {
      return { error: 'گروه والد یافت نشد.' };
    }
    if (parent.parentId !== null) {
      return { error: 'ساختار دسته‌ها فقط دو سطح است: گروه ← دسته.' };
    }
    if (existing._count.children > 0) {
      return { error: 'گروه دارای زیردسته نمی‌تواند زیر مجموعه شود.' };
    }
  }

  const slug =
    slugify(name) === existing.slug ? existing.slug : await uniqueCategorySlug(slugify(name), id);

  const row = await prisma.category.update({
    where: { id },
    data: {
      name,
      slug,
      parentId: input.parentId ?? null,
      ...(input.placements !== undefined ? { placements: JSON.stringify(input.placements) } : {}),
    },
    include: { _count: { select: { products: true } } },
  });

  return {
    category: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      parentId: row.parentId,
      productCount: row._count.products,
      children: [],
      placements: parseSectionPlacements(row.placements),
    },
  };
}

/** Deletes a category; refuses when children or products still depend on it. */
export async function deleteCategory(id: string): Promise<{ ok: true } | { error: string }> {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!existing) {
    return { error: 'دسته یافت نشد.' };
  }
  if (existing._count.children > 0) {
    return { error: 'ابتدا زیردسته‌های این گروه را حذف یا جابه‌جا کنید.' };
  }
  if (existing._count.products > 0) {
    return { error: 'ابتدا محصولات این دسته را جابه‌جا کنید.' };
  }

  await prisma.category.delete({ where: { id } });
  return { ok: true };
}

/** Replaces a product's category assignments with the given id list. */
export async function setProductCategories(
  productId: string,
  categoryIds: string[]
): Promise<void> {
  const valid = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.productCategory.deleteMany({ where: { productId } });
    for (const category of valid) {
      await tx.productCategory.upsert({
        where: { productId_categoryId: { productId, categoryId: category.id } },
        create: { productId, categoryId: category.id },
        update: {},
      });
    }
  });
}

/** The category ids currently assigned to a product. */
export async function getProductCategoryIds(productId: string): Promise<string[]> {
  const rows = await prisma.productCategory.findMany({
    where: { productId },
    select: { categoryId: true },
  });
  return rows.map((row) => row.categoryId);
}

/** Product ids in the given categories (used by coupon category rules). */
export async function productIdsInCategories(categoryIds: string[]): Promise<string[]> {
  if (categoryIds.length === 0) {
    return [];
  }
  const rows = await prisma.productCategory.findMany({
    where: { categoryId: { in: categoryIds } },
    select: { productId: true },
  });
  return [...new Set(rows.map((row) => row.productId))];
}
