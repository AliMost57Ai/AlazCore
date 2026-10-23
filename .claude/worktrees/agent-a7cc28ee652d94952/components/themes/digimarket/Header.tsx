'use client';

import type { ShopSession } from '@/components/shop/ShopActions';
import type { CategoryDTO } from '@/lib/categories';
import type { SiteSettings } from '@/lib/theme-settings';
import ThemeHeaderBase, { type NavEntry } from '../shared/ThemeHeaderBase';
import classes from './digimarket.module.css';

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
  { href: '/#smartDeal', label: 'شگفت‌انگیز' },
  { href: '/#categoryGrid', label: 'دسته‌بندی‌ها' },
  { href: '/#productGrid', label: 'محصولات' },
  { href: '/#brandCarousel', label: 'برندها' },
];

/** DigiMarket header: dark bar, bold brand, prominent search + category chips. */
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
