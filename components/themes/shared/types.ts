/**
 * Shared prop shape every themed storefront page receives from the (public)
 * shop pages: app/page.tsx and app/shop/[slug]/page.tsx. The data is loaded
 * once, server-side; the theme components stay presentational.
 */

import type { ShopSession } from '@/components/shop/ShopActions';
import type { BrandChip } from '@/lib/brands';
import type { CategoryDTO } from '@/lib/categories';
import type { ProductDTO } from '@/lib/products';
import type { SiteSettings } from '@/lib/theme-settings';
import type { ResolvedTheme } from '@/lib/themes';

export interface StorefrontProps {
  /** The active theme definition merged with its resolved configuration. */
  theme: ResolvedTheme;
  /** Visible products (already search/category-filtered). */
  products: ProductDTO[];
  /** The full category tree — powers header nav and filter chips. */
  categories: CategoryDTO[];
  /** برندهای فعال — کروسل برند و لینک فیلتر /?brand=slug. */
  brands: BrandChip[];
  /**
   * Theme-section pins for the ACTIVE theme (Batch M point 4):
   * productId → pinned section ids. Empty/missing = show everywhere. A
   * product's list already merges the pins of its categories.
   */
  productSections: Record<string, string[]>;
  /** categoryId → pinned section ids for the ACTIVE theme (category grids). */
  categorySections: Record<string, string[]>;
  session: ShopSession | null;
  site: SiteSettings;
  /** The active search term, if the visitor searched. */
  q?: string;
  /** The active category id, if the visitor filtered by category. */
  category?: string;
  /** اسلاگ برند فعال، اگر بازدیدکننده با /?brand= فیلتر کرده باشد. */
  brand?: string;
  /** True when Shahkar matching is on — the signup step asks for کد ملی. */
  requireNationalId?: boolean;
}
