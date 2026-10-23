import type { MetadataRoute } from 'next';
import { listProducts } from '@/lib/products';
import { getSiteSettings } from '@/lib/theme-settings';

/**
 * The storefront sitemap: the landing page plus one URL per visible product.
 * Uses the admin's مشخصات سایت → آدرس سایت as the base; without a configured
 * site URL Next falls back to metadataBase-relative URLs, so the map still
 * renders (relative) for local checks.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [site, products] = await Promise.all([
    getSiteSettings(),
    listProducts({ visibility: true }),
  ]);
  const base = site.siteUrl.replace(/\/+$/, '');

  return [
    {
      url: base || '/',
      changeFrequency: 'daily',
      priority: 1,
    },
    ...products.map((product) => ({
      url: base
        ? `${base}/shop/${encodeURIComponent(product.slug)}`
        : `/shop/${encodeURIComponent(product.slug)}`,
      // updatedAt (ISO string) is the freshest signal we have per product.
      lastModified: new Date(product.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
