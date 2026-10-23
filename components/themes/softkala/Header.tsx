'use client';

import type { ShopSession } from '@/components/shop/ShopActions';
import type { CategoryDTO } from '@/lib/categories';
import type { SiteSettings } from '@/lib/theme-settings';
import ThemeHeaderBase, { type NavEntry } from '../shared/ThemeHeaderBase';
import classes from './softkala.module.css';

export interface HeaderProps {
  session: ShopSession | null;
  site: SiteSettings;
  q?: string;
  categories: CategoryDTO[];
  category?: string;
  /** True when Shahkar matching is on — the signup step asks for کد ملی. */
  requireNationalId?: boolean;
}

const NAV: NavEntry[] = [
  { href: '/', label: 'خانه' },
  { href: '/#categoryFeature', label: 'دسته‌بندی‌ها' },
  { href: '/#productGrid', label: 'محصولات' },
];

/** SoftKala header: clean white tech bar, blue-accent nav, category chips, search. */
export default function Header({
  session,
  site,
  q,
  categories,
  category,
  requireNationalId,
}: HeaderProps) {
  return (
    <ThemeHeaderBase
      session={session}
      siteName={site.siteName}
      logoPath={site.logoPath || undefined}
      nav={NAV}
      showSearch
      q={q}
      categories={categories}
      category={category}
      headerClassName={classes.headerBar}
      requireNationalId={requireNationalId}
    />
  );
}
