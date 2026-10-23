import type { Metadata } from 'next';
import { ShopCartProvider } from '@/components/shop/ShopCartProvider';
import SupportChatWidget from '@/components/shop/SupportChatWidget';
import StorefrontPage from '@/components/themes/StorefrontPage';
import { getSession } from '@/lib/auth';
import { listCategories, type CategoryDTO } from '@/lib/categories';
import { listMetaTagsForHead } from '@/lib/meta-tags';
import { listProducts } from '@/lib/products';
import { getAppSettings } from '@/lib/settings';
import { resolveSupportWidgetConfig } from '@/lib/support-status';
import { getActiveTheme, getSiteSettings } from '@/lib/theme-settings';
import { THEME_MAP } from '@/lib/themes';
import { getWalletBalance } from '@/lib/wallet';

export async function generateMetadata(): Promise<Metadata> {
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
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const [products, session, active, site, metaTags, categories, appSettings] = await Promise.all([
    listProducts({
      search: q?.trim() || undefined,
      visibility: true,
      categoryId: category?.trim() || undefined,
    }),
    getSession(),
    getActiveTheme(),
    getSiteSettings(),
    listMetaTagsForHead(),
    listCategories(),
    getAppSettings(),
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
        productSections={productSections}
        categorySections={categorySections}
        session={session ? { name: session.name, role: session.role, walletBalance } : null}
        site={site}
        q={q?.trim() || undefined}
        category={category?.trim() || undefined}
        requireNationalId={appSettings.shahkarEnabled}
      />

      {/* Storefront support chat — guests and customers only; staff answer
          tickets from the panel. Fixed-position, so it sits outside the theme
          markup and no theme file needs to know about it. Its corner, entrance
          animation and greeting come from تنظیمات ← پشتیبانی. */}
      {appSettings.supportEnabled && (!session || session.role === 'customer') ? (
        <SupportChatWidget
          customerName={session?.name ?? null}
          welcome={appSettings.supportWelcome}
          config={resolveSupportWidgetConfig(appSettings)}
        />
      ) : null}
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
