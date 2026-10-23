import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './globals.css';

import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import { getDirection } from '@/lib/auth';
import { getSiteSettings } from '@/lib/theme-settings';
import { Providers } from './providers';

/** Site name/favicon/description come from مشخصات سایت — the admin-editable identity. */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();

  return {
    metadataBase: site.siteUrl ? new URL(site.siteUrl) : undefined,
    title: {
      default: site.siteName,
      template: `%s — ${site.siteName}`,
    },
    description:
      site.aboutUs || 'پنل مدیریت راست‌به‌چپ و واکنش‌گرا، ساخته‌شده با Mantine و Next.js',
    applicationName: site.siteName,
    ...(site.faviconPath ? { icons: { icon: `/api/files/${site.faviconPath}` } } : {}),
    // Social share cards — Persian e-commerce defaults, per-page metadata
    // (app/shop/[slug]) overrides title/description per product.
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      siteName: site.siteName,
      title: site.siteName,
      description: site.aboutUs || 'فروشگاه اینترنتی',
      ...(site.siteUrl ? { url: site.siteUrl } : {}),
      ...(site.logoPath ? { images: [`/api/files/${site.logoPath}`] } : {}),
    },
    twitter: {
      card: 'summary',
      ...(site.logoPath ? { images: [`/api/files/${site.logoPath}`] } : {}),
    },
    robots: {
      // The panel pages are behind a login anyway; keep the storefront crawlable.
      index: true,
      follow: true,
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // No maximumScale / userScalable:false — pinch-zoom must keep working.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#242424' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Direction is a cookie, so `<html dir>` is correct on the very first paint —
  // no RTL flash. This also opts the app out of static rendering, which is fine:
  // every page behind /login is per-user anyway.
  const dir = await getDirection();

  return (
    <html lang="fa" dir={dir} {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <link rel="shortcut icon" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Vazirmatn is the de-facto Persian UI face — both the panel and all
            four storefront themes use it (theme.ts falls back to Tahoma if
            this request fails; the reference storefronts use iranyekan /
            iransans, which Vazirmatn stands in for). */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap"
        />
      </head>
      <body>
        <Providers initialDirection={dir}>{children}</Providers>
      </body>
    </html>
  );
}
