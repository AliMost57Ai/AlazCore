import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Anchor, Breadcrumbs, Text } from '@mantine/core';
import ProductView from '@/components/shop/ProductView';
import { ShopCartProvider } from '@/components/shop/ShopCartProvider';
import SupportChatWidget from '@/components/shop/SupportChatWidget';
import shared from '@/components/themes/shared/theme-shared.module.css';
import StorefrontChrome from '@/components/themes/StorefrontChrome';
import { getSession } from '@/lib/auth';
import { listCategories } from '@/lib/categories';
import { getVisibleProductBySlug } from '@/lib/products';
import { getAppSettings } from '@/lib/settings';
import { resolveSupportWidgetConfig } from '@/lib/support-status';
import { getActiveTheme, getSiteSettings } from '@/lib/theme-settings';
import { THEME_MAP } from '@/lib/themes';
import { getWalletBalance } from '@/lib/wallet';

type PageProps = { params: Promise<{ slug: string }> };

/**
 * Next hands dynamic params over percent-encoded (e.g. "%D9%82%D8%A7%D8%A8"),
 * while DB slugs are decoded Unicode — decode before querying. Malformed
 * sequences fall back to the raw value so a stray "%" can't throw.
 */
function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Per-product metadata — the browser tab and share cards carry the name. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [product, site] = await Promise.all([
    getVisibleProductBySlug(decodeSlug(slug)),
    getSiteSettings(),
  ]);
  const base = site.siteUrl.replace(/\/+$/, '');
  const url = base
    ? `${base}/shop/${encodeURIComponent(slug)}`
    : `/shop/${encodeURIComponent(slug)}`;

  return {
    title: product ? product.name : 'محصول یافت نشد',
    description: product
      ? `${product.name} — مشخصات، قیمت و موجودی در ${site.siteName}.`
      : 'این محصول وجود ندارد یا نمایش آن پنهان است.',
    alternates: { canonical: url },
    openGraph: product
      ? {
          type: 'website',
          locale: 'fa_IR',
          siteName: site.siteName,
          title: product.name,
          description: `${product.name} — مشخصات، قیمت و موجودی در ${site.siteName}.`,
          url,
          ...(product.images.length > 0
            ? {
                images: [
                  product.images[0].path.startsWith('http')
                    ? product.images[0].path
                    : `${base || ''}/api/files/${product.images[0].path}`,
                ],
              }
            : site.logoPath
              ? { images: [`${base || ''}/api/files/${site.logoPath}`] }
              : {}),
        }
      : undefined,
  };
}

/**
 * Product structured data (schema.org/Product) so search engines can show
 * price/availability rich results for the storefront's product pages.
 */
function productJsonLd(
  product: NonNullable<Awaited<ReturnType<typeof getVisibleProductBySlug>>>,
  siteName: string,
  base: string
): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: `${product.name} — مشخصات، قیمت و موجودی در ${siteName}.`,
    ...(product.images.length > 0
      ? {
          image: product.images.map((image) =>
            image.path.startsWith('http') ? image.path : `${base}/api/files/${image.path}`
          ),
        }
      : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'IRR',
      price: product.price * 10, // schema.org wants Rial; prices are stored in Toman.
      availability:
        product.qty > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      ...(base ? { url: `${base}/shop/${encodeURIComponent(product.slug)}` } : {}),
    },
  });
}

export const dynamic = 'force-dynamic';

/**
 * Public product page. Only visible products resolve — a hidden product's
 * slug 404s rather than leaking its existence. The page is framed by the
 * active theme's chrome (palette, header, footer) so it matches the
 * storefront the visitor came from.
 */
export default async function ShopProductPage({ params }: PageProps) {
  const { slug } = await params;
  const [product, session, active, site, categories, appSettings] = await Promise.all([
    getVisibleProductBySlug(decodeSlug(slug)),
    getSession(),
    getActiveTheme(),
    getSiteSettings(),
    listCategories(),
    getAppSettings(),
  ]);

  if (!product) {
    notFound();
  }

  // The header chip shows customers their wallet balance — staff never see it.
  const walletBalance = session?.role === 'customer' ? await getWalletBalance(session.sub) : 0;
  const theme = { ...THEME_MAP[active.id], config: active.config };
  const base = site.siteUrl.replace(/\/+$/, '');

  return (
    <ShopCartProvider>
      {/* Product structured data for rich results (see productJsonLd). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: productJsonLd(product, site.siteName, base) }}
      />
      <StorefrontChrome
        theme={theme}
        categories={categories}
        session={session ? { name: session.name, role: session.role, walletBalance } : null}
        site={site}
        requireNationalId={appSettings.shahkarEnabled}
      >
        <div className={shared.wrap} style={{ paddingBlock: 24, flex: 1 }}>
          <Breadcrumbs mb="md">
            <Anchor href="/" size="sm">
              {site.siteName}
            </Anchor>
            <Text size="sm" c="dimmed">
              {product.name}
            </Text>
          </Breadcrumbs>

          <ProductView product={product} />
        </div>
      </StorefrontChrome>

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
