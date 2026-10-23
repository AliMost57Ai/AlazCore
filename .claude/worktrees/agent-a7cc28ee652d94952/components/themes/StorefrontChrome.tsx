import type { ReactNode } from 'react';
import type { ShopSession } from '@/components/shop/ShopActions';
import type { CategoryDTO } from '@/lib/categories';
import type { SiteSettings } from '@/lib/theme-settings';
import type { ResolvedTheme } from '@/lib/themes';
import BeautyShopFooter from './beautyshop/Footer';
import BeautyShopHeader from './beautyshop/Header';
import DigiMarketFooter from './digimarket/Footer';
import DigiMarketHeader from './digimarket/Header';
import DigiShopFooter from './digishop/Footer';
import DigiShopHeader from './digishop/Header';
import ThemeShell from './shared/ThemeShell';
import SoftKalaFooter from './softkala/Footer';
import SoftKalaHeader from './softkala/Header';

/** Just the chrome inputs — no product data or section pins needed here. */
interface ChromeProps {
  theme: ResolvedTheme;
  categories: CategoryDTO[];
  session: ShopSession | null;
  site: SiteSettings;
  q?: string;
  /** True when Shahkar matching is on — the signup step asks for کد ملی. */
  requireNationalId?: boolean;
  children: ReactNode;
}

/**
 * Wraps an inner storefront page (today: the product detail page at
 * /shop/[slug]) in the active theme's palette, header, and footer — so
 * navigating from the landing page to a product keeps the same look.
 * Respects the admin's header/footer toggles.
 */
export default function StorefrontChrome({
  theme,
  categories,
  session,
  site,
  q,
  requireNationalId,
  children,
}: ChromeProps) {
  const headerOn = theme.config.sections.header?.enabled !== false;
  const footerOn = theme.config.sections.footer?.enabled !== false;

  let header = null;
  let footer = null;
  switch (theme.id) {
    case 'digimarket':
      header = (
        <DigiMarketHeader
          session={session}
          site={site}
          q={q}
          categories={categories}
          requireNationalId={requireNationalId}
        />
      );
      footer = <DigiMarketFooter site={site} />;
      break;
    case 'digishop':
      header = (
        <DigiShopHeader
          session={session}
          site={site}
          q={q}
          categories={categories}
          requireNationalId={requireNationalId}
        />
      );
      footer = <DigiShopFooter site={site} categories={categories} />;
      break;
    case 'softkala':
      header = (
        <SoftKalaHeader
          session={session}
          site={site}
          q={q}
          categories={categories}
          requireNationalId={requireNationalId}
        />
      );
      footer = <SoftKalaFooter site={site} />;
      break;
    case 'beautyshop':
    default:
      header = (
        <BeautyShopHeader
          session={session}
          site={site}
          categories={categories}
          requireNationalId={requireNationalId}
        />
      );
      footer = <BeautyShopFooter site={site} />;
  }

  return (
    <ThemeShell theme={theme} config={theme.config}>
      {headerOn ? header : null}
      {children}
      {footerOn ? footer : null}
    </ThemeShell>
  );
}
