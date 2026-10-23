'use client';

import type { CSSProperties } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { Image, TextInput } from '@mantine/core';
import ShopActions, { type ShopSession } from '@/components/shop/ShopActions';
import type { CategoryDTO } from '@/lib/categories';
import classes from './theme-shared.module.css';

export interface NavEntry {
  href: string;
  label: string;
}

export interface ThemeHeaderBaseProps {
  session: ShopSession | null;
  siteName: string;
  logoPath?: string;
  nav: NavEntry[];
  /** Offer the storefront's native GET search form (DigiMarket/SoftKala). */
  showSearch?: boolean;
  q?: string;
  /** Category tree — top-level groups become filter chips after the nav. */
  categories?: CategoryDTO[];
  /** The active category id (highlighted chip). */
  category?: string;
  /** The bar's themed look (background/color), set by each theme's header. */
  barStyle?: CSSProperties;
  /** Extra classes (each theme's module) layered on the shared scaffolding. */
  headerClassName?: string;
  /** True when Shahkar matching is on — the signup step asks for کد ملی. */
  requireNationalId?: boolean;
}

/**
 * The common header skeleton every theme wraps: brand (uploaded logo or an
 * initial mark) → nav anchors → optional search → the shared cart/auth
 * cluster (ShopActions). Category groups render as ?category= filter chips.
 * Themes pass their own barStyle so the same bones read as four different
 * headers.
 */
export default function ThemeHeaderBase({
  session,
  siteName,
  logoPath,
  nav,
  showSearch = false,
  q,
  categories,
  category,
  barStyle,
  headerClassName,
  requireNationalId = false,
}: ThemeHeaderBaseProps) {
  return (
    <header
      className={headerClassName ? `${classes.headerBar} ${headerClassName}` : classes.headerBar}
      style={barStyle}
    >
      <div className={`${classes.wrap} ${classes.headerInner}`}>
        <a className={classes.brand} href="/">
          {logoPath ? (
            <Image src={`/api/files/${logoPath}`} alt={siteName} className={classes.brandLogo} />
          ) : (
            <span className={classes.brandMark}>{siteName.trim().charAt(0) || 'ف'}</span>
          )}
          <span>{siteName}</span>
        </a>

        <nav className={classes.nav} aria-label="ناوبری فروشگاه">
          {nav.map((entry) => (
            <a key={entry.href} className={classes.navLink} href={entry.href}>
              {entry.label}
            </a>
          ))}
          {(categories ?? []).slice(0, 6).map((group) => (
            <a
              key={group.id}
              className={
                category === group.id
                  ? `${classes.navLink} ${classes.navLinkActive}`
                  : classes.navLink
              }
              href={`/?category=${encodeURIComponent(group.id)}`}
            >
              {group.name}
            </a>
          ))}
        </nav>

        {showSearch ? (
          <form method="get" action="/" className={classes.searchForm}>
            {/* Keep the active category when searching from a filtered view. */}
            {category ? <input type="hidden" name="category" value={category} /> : null}
            <TextInput
              name="q"
              defaultValue={q ?? ''}
              placeholder="جستجوی محصول…"
              aria-label="جستجوی محصول"
              leftSection={<IconSearch size={16} />}
              size="xs"
              styles={{ input: { background: 'rgb(255 255 255 / 92%)' } }}
            />
          </form>
        ) : null}

        <ShopActions session={session} requireNationalId={requireNationalId} />
      </div>
    </header>
  );
}
