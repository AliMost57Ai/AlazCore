import type { MetadataRoute } from 'next';
import { getSiteSettings } from '@/lib/theme-settings';

/**
 * robots.txt: the public storefront (/ and /shop/*) is crawlable; the admin
 * panel, auth, account and API stay out of the index. The sitemap URL rides
 * along when the admin has configured آدرس سایت (مشخصات سایت).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSiteSettings();
  const base = site.siteUrl.replace(/\/+$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/shop'],
        disallow: [
          '/api/',
          '/login',
          '/login-otp',
          '/signup',
          '/forgot',
          '/settings',
          '/dashboard',
          '/orders',
          '/products',
          '/customers',
          '/pay',
        ],
      },
    ],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
