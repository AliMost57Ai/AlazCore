'use client';

import type { ShopSession } from '@/components/shop/ShopActions';
import type { CategoryDTO } from '@/lib/categories';
import type { SiteSettings } from '@/lib/theme-settings';
import ThemeHeaderBase, { type NavEntry } from '../shared/ThemeHeaderBase';
import classes from './beautyshop.module.css';

export interface HeaderProps {
  session: ShopSession | null;
  site: SiteSettings;
  categories: CategoryDTO[];
  category?: string;
  /** True when Shahkar matching is on — the signup step asks for کد ملی. */
  requireNationalId?: boolean;
}

const NAV: NavEntry[] = [
  { href: '/', label: 'خانه' },
  { href: '/#bestSellers', label: 'پرفروش‌ترین‌ها' },
  { href: '/#latestPosts', label: 'مجله' },
  { href: '/#newsletter', label: 'خبرنامه' },
];

/**
 * BeautyShop header: light and airy — brand, pill nav (with category group
 * filter chips), cart/auth cluster. (No search field; the soft look keeps
 * the bar to a single row.)
 */
export default function Header({
  session,
  site,
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
      categories={categories}
      category={category}
      headerClassName={classes.headerBar}
      requireNationalId={requireNationalId}
    />
  );
}
