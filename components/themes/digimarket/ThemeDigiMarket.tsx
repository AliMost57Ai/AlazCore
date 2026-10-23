import { itemsForSection, treeForSection } from '@/lib/section-placements';
import ThemeShell from '../shared/ThemeShell';
import type { StorefrontProps } from '../shared/types';
import BrandCarousel from './BrandCarousel';
import CategoryGrid from './CategoryGrid';
import Footer from './Footer';
import Header from './Header';
import ProductGrid from './ProductGrid';
import SmartDealBanner from './SmartDealBanner';

/**
 * DigiMarket theme root: dark technical storefront — smart deal banner,
 * category tiles, product wall, brand carousel — every section toggleable
 * and retitleable from the admin customizer.
 */
export default function ThemeDigiMarket({
  theme,
  products,
  categories,
  brands,
  productSections,
  categorySections,
  session,
  site,
  q,
  category,
  requireNationalId,
}: StorefrontProps) {
  const config = theme.config;
  const section = (id: string) => config.sections[id];

  const searched = (typeof q === 'string' && q.trim() !== '') || category !== undefined;
  const gridTitle = category
    ? 'محصولات دسته انتخابی'
    : typeof q === 'string' && q.trim() !== ''
      ? `نتایج جستجو برای «${q}»`
      : section('productGrid').title;

  // Section pins (Batch M point 4) apply only to the curated landing view —
  // search/category results keep showing every match.
  const gridProducts = searched
    ? products
    : itemsForSection(products, 'productGrid', productSections);

  return (
    <ThemeShell theme={theme} config={config}>
      {section('header').enabled ? (
        <Header
          session={session}
          site={site}
          q={q}
          categories={categories}
          category={category}
          requireNationalId={requireNationalId}
        />
      ) : null}

      {section('smartDeal').enabled && !searched ? (
        <SmartDealBanner
          title={section('smartDeal').title}
          products={itemsForSection(products, 'smartDeal', productSections)}
        />
      ) : null}

      {section('categoryGrid').enabled && !searched ? (
        <CategoryGrid
          title={section('categoryGrid').title}
          categories={treeForSection(categories, 'categoryGrid', categorySections)}
        />
      ) : null}

      {section('productGrid').enabled ? (
        <ProductGrid title={gridTitle} products={gridProducts} />
      ) : null}

      {section('brandCarousel').enabled && !searched ? (
        <BrandCarousel title={section('brandCarousel').title} brands={brands} />
      ) : null}


      {section('footer').enabled ? <Footer site={site} /> : null}
    </ThemeShell>
  );
}
