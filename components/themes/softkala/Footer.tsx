import type { SiteSettings } from '@/lib/theme-settings';
import ThemeFooterBase, { type FooterColumn } from '../shared/ThemeFooterBase';
import classes from './softkala.module.css';

export interface FooterProps {
  site: SiteSettings;
}

const COLUMNS: FooterColumn[] = [
  {
    title: 'دسته‌بندی‌ها',
    links: [
      { href: '/#categoryFeature', label: 'کیس و فن' },
      { href: '/#categoryFeature', label: 'کارت گرافیک' },
      { href: '/#productGrid', label: 'لوازم جانبی سخت‌افزار' },
    ],
  },
  {
    title: 'پشتیبانی فنی',
    links: [
      { href: '/faq', label: 'سوالات متداول' },
      { href: '/#productGrid', label: 'راهنمای خرید قطعات' },
      { href: '/#productGrid', label: 'استعلام گارانتی' },
    ],
  },
];

/** SoftKala footer: info-heavy dark panel (contact + columns + copyright). */
export default function Footer({ site }: FooterProps) {
  return <ThemeFooterBase site={site} columns={COLUMNS} className={classes.footer} />;
}
