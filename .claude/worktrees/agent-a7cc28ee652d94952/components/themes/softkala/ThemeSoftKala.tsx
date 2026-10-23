import { itemsForSection, treeForSection } from '@/lib/section-placements';
import ThemeShell from '../shared/ThemeShell';
import type { StorefrontProps } from '../shared/types';
import CategoryFeature from './CategoryFeature';
import Footer from './Footer';
import Header from './Header';
import ProductGrid from './ProductGrid';

/**
 * SoftKala theme root: clean tech storefront — category feature cards and a
 * dense product grid — every section toggleable and retitleable from the
 * admin customizer.
 */
export default function ThemeSoftKala({
  theme,
  products,
  categories,
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

  // Section pins (Batch M point 4) shape the curated landing view only —
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

      {section('categoryFeature').enabled && !searched ? (
        <CategoryFeature
          title={section('categoryFeature').title}
          categories={treeForSection(categories, 'categoryFeature', categorySections)}
        />
      ) : null}

      {section('productGrid').enabled ? (
        <ProductGrid title={gridTitle} products={gridProducts} />
      ) : null}

      {section('footer').enabled ? <Footer site={site} /> : null}
    </ThemeShell>
  );
}
