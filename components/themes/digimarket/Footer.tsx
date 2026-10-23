import type { SiteSettings } from '@/lib/theme-settings';
import ThemeFooterBase, { type FooterColumn } from '../shared/ThemeFooterBase';
import classes from './digimarket.module.css';

export interface FooterProps {
  site: SiteSettings;
}

const COLUMNS: FooterColumn[] = [
  {
    title: 'دسته‌بندی‌ها',
    links: [
      { href: '/#categoryGrid', label: 'گوشی موبایل' },
      { href: '/#categoryGrid', label: 'لوازم جانبی' },
      { href: '/#productGrid', label: 'پرفروش‌ترین‌ها' },
      { href: '/#brandCarousel', label: 'برندها' },
    ],
  },
  {
    title: 'پشتیبانی',
    links: [
      { href: '/faq', label: 'سوالات متداول' },
      { href: '/#smartDeal', label: 'پیگیری سفارش' },
      { href: '/#smartDeal', label: 'گارانتی و خدمات' },
    ],
  },
];

/** DigiMarket footer: dark, technical, info-dense. */
export default function Footer({ site }: FooterProps) {
  return <ThemeFooterBase site={site} columns={COLUMNS} className={classes.footer} />;
}
