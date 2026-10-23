import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './globals.css';

import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'پنل Core | AlazCore',
    template: '%s | پنل Core AlazCore',
  },
  description: 'سامانه مرکزی مدیریت دامین‌ها، پلن‌ها، تم‌ها و لایسنس فروشگاه‌ساز AlazCore',
  applicationName: 'AlazCore Core Panel',
  icons: { icon: '/favicon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1B2A34' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // پنل Core فارسی و راست‌به‌چپ است — همیشه.
    <html lang="fa" dir="rtl" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
