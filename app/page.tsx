import type { Metadata } from 'next';
import { ShopCartProvider } from '@/components/shop/ShopCartProvider';
import SupportChatMount from '@/components/shop/SupportChatMount';
import StorefrontPage from '@/components/themes/StorefrontPage';
import { getSession } from '@/lib/auth';
import { getActiveBrandIdBySlug, listActiveBrandChips } from '@/lib/brands';
import { listCategories, type CategoryDTO } from '@/lib/categories';
import { listMetaTagsForHead } from '@/lib/meta-tags';
import { listProducts } from '@/lib/products';
import { getAppSettings } from '@/lib/settings';
import { ensureSiteContext } from '@/lib/site-context';
import { getActiveTheme, getSiteSettings } from '@/lib/theme-settings';
import { THEME_MAP } from '@/lib/themes';
import { getWalletBalance } from '@/lib/wallet';

export async function generateMetadata(): Promise<Metadata> {
  await ensureSiteContext();
  const site = await getSiteSettings();
  const base = site.siteUrl.replace(/\/+$/, '');

  return {
    title: site.siteName,
    description: site.aboutUs || 'محصولات موجود در فروشگاه را ببینید.',
    alternates: { canonical: base || '/' },
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      siteName: site.siteName,
      title: site.siteName,
      description: site.aboutUs || 'محصولات موجود در فروشگاه را ببینید.',
      ...(base ? { url: base } : {}),
      ...(site.logoPath ? { images: [`${base || ''}/api/files/${site.logoPath}`] } : {}),
    },
  };
}

export const dynamic = 'force-dynamic';

/**
 * The site root is the public shop landing — no session required (proxy.ts
 * lists '/' as public and only isVisible products are ever queried here).
 * The page itself is rendered by the ACTIVE theme (تنظیمات ← قالب فروشگاه);
 * this route only gathers the data every theme needs.
 */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; brand?: string }>;
}) {
  const { q, category, brand } = await searchParams;
  // فیلتر برند با اسلاگ می‌آید (/?brand=…) — به id فعال resolve می‌شود؛
  // برند ناموجود/غیرفعال مثل نبودنِ فیلتر است.
  const brandId = brand?.trim() ? await getActiveBrandIdBySlug(brand.trim()) : null;
  const [products, session, active, site, metaTags, categories, appSettings, brandChips] =
    await Promise.all([
      listProducts({
        search: q?.trim() || undefined,
        visibility: true,
        categoryId: category?.trim() || undefined,
        ...(brandId ? { brandId } : {}),
      }),
      getSession(),
      getActiveTheme(),
      getSiteSettings(),
      listMetaTagsForHead(),
      listCategories(),
      getAppSettings(),
      listActiveBrandChips(),
    ]);

  // The header chip shows customers their wallet balance — staff never see it.
  const walletBalance = session?.role === 'customer' ? await getWalletBalance(session.sub) : 0;

  // Theme-section placements (Batch M point 4): each product's effective pins
  // are its own list for the ACTIVE theme plus the lists of its categories;
  // empty = unpinned → shows everywhere. Categories keep their own lists for
  // the category-grid sections.
  const categoryPlacements = new Map(
    flattenCategories(categories).map((node) => [node.id, node.placements[active.id] ?? []])
  );
  const productSections: Record<string, string[]> = Object.fromEntries(
    products.map((product) => [
      product.id,
      [
        ...new Set([
          ...(product.placements[active.id] ?? []),
          ...product.categoryIds.flatMap((categoryId) => categoryPlacements.get(categoryId) ?? []),
        ]),
      ],
    ])
  );
  const categorySections: Record<string, string[]> = Object.fromEntries([
    ...categoryPlacements.entries(),
  ]);

  // The theme definition merged with its resolved (admin-customized) config.
  const theme = { ...THEME_MAP[active.id], config: active.config };

  // Storefront structured data: a small ItemList of the visible products so
  // search engines can associate the landing page with its catalog.
  const itemListJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: site.siteName,
    numberOfItems: Math.min(products.length, 20),
    itemListElement: products.slice(0, 20).map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: product.name,
      url: `/shop/${encodeURIComponent(product.slug)}`,
    })),
  });

  return (
    <ShopCartProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />

      {/* Admin-managed meta codes (تنظیمات ← کدهای متا) — each slot is
          validated per kind in lib/meta-tags.ts, so only allowlisted
          tag/attribute shapes reach the DOM. Public storefront only. */}
      {metaTags.map((tag) => (
        <div key={tag.id} hidden dangerouslySetInnerHTML={{ __html: tag.html }} />
      ))}

      <StorefrontPage
        theme={theme}
        products={products}
        categories={categories}
        brands={brandChips}
        productSections={productSections}
        categorySections={categorySections}
        session={session ? { name: session.name, role: session.role, walletBalance } : null}
        site={site}
        q={q?.trim() || undefined}
        category={category?.trim() || undefined}
        brand={brand?.trim() || undefined}
        requireNationalId={appSettings.shahkarEnabled}
      />

      {/* ویجت چت پشتیبانی — fixed بیرون از مارک‌آپ تم می‌نشیند؛ خودش تصمیم
          می‌گیرد مونت شود یا نه (پشتیبانی خاموش / پرسنل). */}
      <SupportChatMount />
    </ShopCartProvider>
  );
}

/** Depth-first walk of the category tree (parents before children). */
function flattenCategories(tree: CategoryDTO[]): CategoryDTO[] {
  const flat: CategoryDTO[] = [];
  const walk = (nodes: CategoryDTO[]) => {
    for (const node of nodes) {
      flat.push(node);
      walk(node.children);
    }
  };
  walk(tree);
  return flat;
}
