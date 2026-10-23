import { itemsForSection } from '@/lib/section-placements';
import ThemeShell from '../shared/ThemeShell';
import type { StorefrontProps } from '../shared/types';
import BestSellersSection from './BestSellersSection';
import Footer from './Footer';
import Header from './Header';
import HeroSlider from './HeroSlider';
import LatestPostsSection from './LatestPostsSection';
import NewsletterSignup from './NewsletterSignup';

/**
 * BeautyShop theme root: composes the storefront from its modular sections,
 * each gated by the admin's toggle and titled from the customizer. The
 * palette/font are applied by the shared ThemeShell via CSS variables.
 */
export default function ThemeBeautyShop({
  theme,
  products,
  categories,
  productSections,
  session,
  site,
  q,
  category,
  requireNationalId,
}: StorefrontProps) {
  const config = theme.config;
  const section = (id: string) => config.sections[id];

  // When the visitor searched or picked a category, the best-sellers section
  // doubles as the results list (every match, retitled) — same grid, honest
  // heading. Search results ignore section pins: a pinned product must stay
  // findable.
  const searched = (typeof q === 'string' && q.trim() !== '') || category !== undefined;
  // کالای ناموجود هم در لیست می‌ماند — کارت سه‌حالته ویترین (موجود / تنها ۱
  // عدد باقی مانده / ناموجود) وضعیت را نشان می‌دهد؛ حذف از لیست فقط با
  // «نمایش در فروشگاه» خاموش (isVisible) است که در listProducts فیلتر شده.
  const unpinned = products.slice(0, 8);
  const shown = searched ? products : itemsForSection(unpinned, 'bestSellers', productSections);
  const bestTitle = category
    ? 'محصولات دسته انتخابی'
    : typeof q === 'string' && q.trim() !== ''
      ? `نتایج جستجو برای «${q}»`
      : section('bestSellers').title;

  // The magazine section shows its own pinned selection (unpinned products
  // still appear — pins only restrict, never hide outright).
  const magazineProducts = searched
    ? products
    : itemsForSection(products, 'latestPosts', productSections);

  return (
    <ThemeShell theme={theme} config={config}>
      {section('header').enabled ? (
        <Header
          session={session}
          site={site}
          categories={categories}
          category={category}
          requireNationalId={requireNationalId}
        />
      ) : null}

      {section('heroSlider').enabled ? (
        <HeroSlider
          title={searched ? 'جستجو در فروشگاه' : section('heroSlider').title}
          siteName={site.siteName}
          productCount={products.length}
        />
      ) : null}

      {section('bestSellers').enabled ? (
        <BestSellersSection title={bestTitle} products={shown} />
      ) : null}

      {!searched && section('latestPosts').enabled ? (
        <LatestPostsSection title={section('latestPosts').title} products={magazineProducts} />
      ) : null}

      {!searched && section('newsletter').enabled ? (
        <NewsletterSignup title={section('newsletter').title} />
      ) : null}

      {section('footer').enabled ? <Footer site={site} /> : null}
    </ThemeShell>
  );
}
