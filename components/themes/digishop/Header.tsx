import { IconMenu2, IconPhone, IconSearch, IconTruck } from '@tabler/icons-react';
import { Image } from '@mantine/core';
import ShopActions, { type ShopSession } from '@/components/shop/ShopActions';
import type { CategoryDTO } from '@/lib/categories';
import type { SiteSettings } from '@/lib/theme-settings';
import classes from './digishop.module.css';

export interface HeaderProps {
  session: ShopSession | null;
  site: SiteSettings;
  categories: CategoryDTO[];
  category?: string;
  /** The active search term, kept in the box after a search. */
  q?: string;
  /** True when Shahkar matching is on — the signup step asks for کد ملی. */
  requireNationalId?: boolean;
}

/**
 * DigiShop header — the design's three tiers: a deep-red utility strip
 * (contact info from مشخصات سایت), the main bar (brand + search + the shared
 * cart/auth cluster), and the category bar (chips + the express-shipping
 * note).
 */
export default function Header({
  session,
  site,
  categories,
  category,
  q,
  requireNationalId,
}: HeaderProps) {
  const groups = categories.slice(0, 8);

  return (
    <header className={classes.header}>
      {/* Tier 1 — utility strip; only when there is real contact info to show. */}
      {site.contactPhone || site.contactEmail ? (
        <div className={classes.topStrip}>
          <div className={`${classes.wrap} ${classes.topStripInner}`}>
            {site.contactPhone ? (
              <span className={classes.topStripNote}>
                <IconPhone size={14} stroke={1.6} aria-hidden="true" />
                تلفن پشتیبانی: {site.contactPhone}
              </span>
            ) : null}
            {site.contactEmail ? (
              <span className={classes.topStripNote}>{site.contactEmail}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Tier 2 — brand, storefront search, cart/auth. */}
      <div className={classes.mainBar}>
        <div className={`${classes.wrap} ${classes.mainBarInner}`}>
          <a className={classes.brand} href="/" aria-label={site.siteName}>
            {site.logoPath ? (
              <Image
                src={`/api/files/${site.logoPath}`}
                alt={site.siteName}
                className={classes.brandLogo}
                w="auto"
              />
            ) : (
              <span className={classes.brandMark}>{site.siteName.trim().charAt(0) || 'د'}</span>
            )}
            <span>
              <span className={classes.brandName}>{site.siteName}</span>
              <span className={classes.brandTagline}>فروشگاه آنلاین کالا و زیبایی</span>
            </span>
          </a>

          <form method="get" action="/" className={classes.searchForm}>
            {/* Keep the active category when searching from a filtered view. */}
            {category ? <input type="hidden" name="category" value={category} /> : null}
            <input
              className={classes.searchInput}
              name="q"
              defaultValue={q ?? ''}
              placeholder="جستجو در فروشگاه… (نام کالا یا دسته‌بندی)"
              aria-label="جستجوی محصول"
              type="text"
            />
            <button className={classes.searchButton} type="submit" aria-label="جستجو">
              <IconSearch size={18} stroke={1.6} />
            </button>
          </form>

          <ShopActions session={session} requireNationalId={requireNationalId} />
        </div>
      </div>

      {/* Tier 3 — category chips + shipping note. */}
      <div className={classes.categoryBar}>
        <div className={`${classes.wrap} ${classes.categoryBarInner}`}>
          <span className={classes.categoryLabel}>
            <IconMenu2 size={20} stroke={1.6} aria-hidden="true" />
            دسته‌بندی کالاها
          </span>
          <nav className={classes.categoryLinks} aria-label="دسته‌بندی کالاها">
            <a
              className={!category && !q ? classes.categoryLinkActive : classes.categoryLink}
              href="/"
            >
              صفحه نخست
            </a>
            {groups.map((group) => (
              <a
                key={group.id}
                className={
                  category === group.id ? classes.categoryLinkActive : classes.categoryLink
                }
                href={`/?category=${encodeURIComponent(group.id)}`}
              >
                {group.name}
              </a>
            ))}
          </nav>
          <span className={classes.shippingNote}>
            <IconTruck size={16} stroke={1.6} aria-hidden="true" />
            ارسال سریع به سراسر کشور
          </span>
        </div>
      </div>
    </header>
  );
}
