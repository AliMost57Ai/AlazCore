import { itemsForSection } from '@/lib/section-placements';
import ThemeShell from '../shared/ThemeShell';
import type { StorefrontProps } from '../shared/types';
import AmazingDeals from './AmazingDeals';
import Footer from './Footer';
import GiftIdeaGrid from './GiftIdeaGrid';
import Header from './Header';
import ProductDisplay from './ProductDisplay';

/**
 * DigiShop theme root: the design's storefront — header, red deal panel,
 * gift-finder categories, the product grid, and the trust footer. Every
 * section stays toggleable and retitleable from the admin customizer.
 */
export default function ThemeDigiShop({
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
  const displayTitle = category
    ? 'محصولات دسته انتخابی'
    : typeof q === 'string' && q.trim() !== ''
      ? `نتایج جستجو برای «${q}»`
      : section('productDisplay').title;

  // Section pins (Batch M point 4) shape the curated landing view only —
  // search/category results keep showing every match.
  const displayProducts = searched
    ? products
    : itemsForSection(products, 'productDisplay', productSections);

  // One shared map: product id → the name of its first assigned category.
  const categoryNames: Record<string, string> = {};
  const nameById = new Map<string, string>();
  const collectNames = (nodes: typeof categories) => {
    for (const node of nodes) {
      nameById.set(node.id, node.name);
      collectNames(node.children);
    }
  };
  collectNames(categories);
  for (const product of products) {
    const first = product.categoryIds.find((id) => nameById.has(id));
    if (first) {
      categoryNames[product.id] = nameById.get(first) as string;
    }
  }

  return (
    <ThemeShell theme={theme} config={config}>
      {section('header').enabled ? (
        <Header
          session={session}
          site={site}
          categories={categories}
          category={category}
          q={q}
          requireNationalId={requireNationalId}
        />
      ) : null}

      {section('amazingDeals').enabled && !searched ? (
        <AmazingDeals
          title={section('amazingDeals').title}
          products={products}
          categoryNames={categoryNames}
          productSections={productSections}
        />
      ) : null}

      {section('giftIdeas').enabled && !searched ? (
        <GiftIdeaGrid
          title={section('giftIdeas').title}
          categories={categories}
          categorySections={categorySections}
        />
      ) : null}

      {section('productDisplay').enabled ? (
        <ProductDisplay
          title={displayTitle}
          products={displayProducts}
          categoryNames={categoryNames}
        />
      ) : null}

      {section('footer').enabled ? <Footer site={site} categories={categories} /> : null}
    </ThemeShell>
  );
}
