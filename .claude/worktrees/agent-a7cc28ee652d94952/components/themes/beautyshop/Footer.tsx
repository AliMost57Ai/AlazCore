import type { SiteSettings } from '@/lib/theme-settings';
import ThemeFooterBase, { type FooterColumn } from '../shared/ThemeFooterBase';
import classes from './beautyshop.module.css';

export interface FooterProps {
  site: SiteSettings;
}

const COLUMNS: FooterColumn[] = [
  {
    title: 'دسترسی سریع',
    links: [
      { href: '/', label: 'خانه' },
      { href: '/#bestSellers', label: 'پرفروش‌ترین‌ها' },
      { href: '/#latestPosts', label: 'مجله' },
      { href: '/#newsletter', label: 'خبرنامه' },
    ],
  },
  {
    title: 'راهنمای خرید',
    links: [
      { href: '/#bestSellers', label: 'نحوه ثبت سفارش' },
      { href: '/#bestSellers', label: 'رویه ارسال سفارش' },
      { href: '/#bestSellers', label: 'شرایط بازگشت کالا' },
    ],
  },
];

/** BeautyShop footer: pastel tint, quick links, contact, social chips. */
export default function Footer({ site }: FooterProps) {
  return (
    <ThemeFooterBase
      site={site}
      columns={COLUMNS}
      className={classes.footer}
      extra={
        <div className={classes.socialRow}>
          <a className={classes.socialChip} href="#">
            اینستاگرام
          </a>
          <a className={classes.socialChip} href="#">
            تلگرام
          </a>
          <a className={classes.socialChip} href="#">
            واتساپ
          </a>
        </div>
      }
    />
  );
}
