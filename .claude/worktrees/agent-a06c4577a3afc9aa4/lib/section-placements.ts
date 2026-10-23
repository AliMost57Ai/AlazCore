/**
 * Theme-section placement (Batch M point 4).
 *
 * Admins can pin a product or a product group/category to specific sections
 * of the ACTIVE storefront theme — «این محصول در کدام قسمت‌ها نمایش داده
 * شود». Storage is a JSON string column on Product and Category:
 *
 *   { "<themeId>": ["<sectionId>", …], … }
 *
 * Semantics (per item, per theme):
 *  - No entry (or empty list) → the item appears everywhere, exactly as
 *    before the feature existed — nothing ever disappears by accident.
 *  - Non-empty list → the item only appears in the listed sections.
 *  - A product's effective placement is the union of its own list and the
 *    lists of the categories it belongs to.
 *
 * Placements are per-theme: each theme keeps its own map, so switching the
 * active theme switches to that theme's placements (and defaults to "show
 * everywhere" until the admin curates it).
 *
 * Pure module — imports only lib/themes (data), safe on the server and in
 * client components.
 */

import { THEME_MAP, type ThemeId } from './themes';

/** The parsed column shape: themeId → section ids pinned for that theme. */
export type SectionPlacements = Record<string, string[]>;

export function parseSectionPlacements(json: string): SectionPlacements {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return {};
  }
  const result: SectionPlacements = {};
  for (const [themeId, sections] of Object.entries(parsed as Record<string, unknown>)) {
    if (!Array.isArray(sections)) {
      continue;
    }
    const ids = sections.filter((id): id is string => typeof id === 'string');
    if (ids.length > 0) {
      result[themeId] = ids;
    }
  }
  return result;
}

/** The sections of one theme that make sense as a placement target — the
 *  header/footer are chrome, not content sections, so they stay out. */
export function placementTargets(themeId: ThemeId): { id: string; label: string }[] {
  return THEME_MAP[themeId].sections
    .filter((section) => section.id !== 'header' && section.id !== 'footer')
    .map((section) => ({ id: section.id, label: section.label }));
}

/**
 * Validates an untrusted sectionIds array from an API body against the given
 * theme's placement targets. Returns the sanitized list (deduped, capped) or
 * a Persian error string.
 */
export function sanitizeSectionIds(
  input: unknown,
  themeId: ThemeId
): { sectionIds: string[] } | { error: string } {
  if (!Array.isArray(input)) {
    return { error: 'فهرست بخش‌های نمایش نامعتبر است.' };
  }
  const valid = new Set(placementTargets(themeId).map((target) => target.id));
  const sectionIds: string[] = [];
  for (const entry of input) {
    if (typeof entry !== 'string' || !valid.has(entry)) {
      return { error: 'یکی از بخش‌های نمایش انتخاب‌شده در قالب فعال وجود ندارد.' };
    }
    if (!sectionIds.includes(entry)) {
      sectionIds.push(entry);
    }
  }
  if (sectionIds.length > 20) {
    return { error: 'حداکثر ۲۰ بخش برای نمایش قابل انتخاب است.' };
  }
  return { sectionIds };
}

/** Merges one theme's list into a stored placements map (others untouched). */
export function mergeSectionPlacement(
  existing: SectionPlacements,
  themeId: ThemeId,
  sectionIds: string[]
): SectionPlacements {
  const merged: SectionPlacements = { ...existing };
  if (sectionIds.length === 0) {
    // An empty selection removes the restriction — "show everywhere" again.
    delete merged[themeId];
  } else {
    merged[themeId] = sectionIds;
  }
  return merged;
}

/** One theme's pinned sections for an item — [] means "show everywhere". */
export function sectionsFor(placements: SectionPlacements, themeId: string): string[] {
  return placements[themeId] ?? [];
}

/**
 * Placement-aware section filter, shared by every themed storefront root.
 * An item pinned to specific sections only passes for those; an unpinned
 * item passes for all — so an uncurated store keeps rendering exactly as
 * before.
 */
export function itemsForSection<T extends { id: string }>(
  items: T[],
  sectionId: string,
  assignments: Record<string, string[]>
): T[] {
  return items.filter((item) => {
    const pinned = assignments[item.id];
    return !pinned || pinned.length === 0 || pinned.includes(sectionId);
  });
}

/** Same rule, applied recursively to a category tree (children too). */
export function treeForSection<T extends { id: string; children: T[] }>(
  nodes: T[],
  sectionId: string,
  assignments: Record<string, string[]>
): T[] {
  const passes = (node: T) => {
    const pinned = assignments[node.id];
    return !pinned || pinned.length === 0 || pinned.includes(sectionId);
  };
  return nodes
    .filter(passes)
    .map((node) => ({ ...node, children: treeForSection(node.children, sectionId, assignments) }));
}
