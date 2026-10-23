import {
  IconHeadset,
  IconHeart,
  IconRocket,
  IconRotate2,
  IconShieldCheck,
} from '@tabler/icons-react';
import { Image } from '@mantine/core';
import type { CategoryDTO } from '@/lib/categories';
import type { SiteSettings } from '@/lib/theme-settings';
import classes from './digishop.module.css';

export interface FooterProps {
  site: SiteSettings;
  /** Top-level categories become the «دسته‌بندی‌های محبوب» column. */
  categories: CategoryDTO[];
}

/** The design's four trust cards — presentational service promises. */
const TRUST = [
  {
    icon: IconShieldCheck,
    title: 'ضمانت اصالت کالا',
    text: 'کالای اورجینال و معتبر',
  },
  {
    icon: IconRocket,
    title: 'ارسال فوق سریع',
    text: 'آماده‌سازی و ارسال سریع سفارش',
  },
  {
    icon: IconHeadset,
    title: 'پشتیبانی پاسخگو',
    text: 'پاسخگویی در روزهای کاری',
  },
  {
    icon: IconRotate2,
    title: '۷ روز ضمانت بازگشت',
    text: 'بازگشت کالا طبق شرایط فروشگاه',
  },
];

/** Storefront anchors the site actually has (no blog/magazine pages). */
const SERVICE_LINKS = [
  { href: '/#amazingDeals', label: 'پیشنهادهای شگفت‌انگیز' },
  { href: '/#giftIdeas', label: 'هدیه چی بدم؟!' },
  { href: '/#productDisplay', label: 'ویترین محصولات' },
  { href: '/login', label: 'ورود / ثبت‌نام' },
];

/**
 * DigiShop footer — the design's white plate: trust-card row, then the link
 * grid (brand + about from مشخصات سایت, خدمات مشتریان, real categories,
 * trust badges) over a copyright bar.
 */
export default function Footer({ site, categories }: FooterProps) {
  const popular = categories.slice(0, 5);

  return (
    <footer className={classes.footer}>
      <div className={classes.wrap}>
        <div className={classes.trustRow}>
          {TRUST.map(({ icon: Icon, title, text }) => (
            <div key={title} className={classes.trustCard}>
              <Icon size={34} stroke={1.3} className={classes.trustIcon} aria-hidden="true" />
              <div>
                <div className={classes.trustTitle}>{title}</div>
                <div className={classes.trustText}>{text}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={classes.footerGrid}>
          <div>
            <div className={classes.footerBrand}>
              {site.logoPath ? (
                <Image
                  src={`/api/files/${site.logoPath}`}
                  alt={site.siteName}
                  className={classes.brandLogo}
                  w="auto"
                />
              ) : (
                <span className={classes.brandMark}>{site.siteName.trim().charAt(0) || 'د'}</span>
              )}
              <span className={classes.footerHead}>{site.siteName}</span>
            </div>
            <p className={classes.footerText}>
              {site.aboutUs || 'فروشگاه اینترنتی — خرید آسان، ارسال سریع.'}
            </p>
            {(site.contactPhone || site.contactAddress) && (
              <p className={classes.footerText}>
                {site.contactPhone ? `تلفن پشتیبانی: ${site.contactPhone}` : ''}
                {site.contactPhone && site.contactAddress ? ' | ' : ''}
                {site.contactAddress || ''}
              </p>
            )}
          </div>

          <nav aria-label="خدمات مشتریان">
            <div className={classes.footerHead}>خدمات مشتریان</div>
            <ul className={classes.footerList}>
              {SERVICE_LINKS.map((link) => (
                <li key={link.href}>
                  <a className={classes.footerLink} href={link.href}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="دسته‌بندی‌های محبوب">
            <div className={classes.footerHead}>دسته‌بندی‌های محبوب</div>
            <ul className={classes.footerList}>
              {popular.map((group) => (
                <li key={group.id}>
                  <a
                    className={classes.footerLink}
                    href={`/?category=${encodeURIComponent(group.id)}`}
                  >
                    {group.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Trust badges (اینماد / رسانه) uploaded in مشخصات سایت. */}
        {site.enamadPath || site.mediaPath ? (
          <div className={classes.badges}>
            {site.enamadPath ? (
              <a
                className={classes.badgeLink}
                href={site.enamadUrl || undefined}
                target={site.enamadUrl ? '_blank' : undefined}
                rel="noopener noreferrer"
              >
                {/* Plain <img>: the badge is a runtime upload served by /api/files. */}
                <img
                  src={`/api/files/${site.enamadPath}`}
                  alt="نشان اینماد"
                  width={85}
                  height={95}
                  className={classes.badgeImg}
                />
              </a>
            ) : null}
            {site.mediaPath ? (
              <a
                className={classes.badgeLink}
                href={site.mediaUrl || undefined}
                target={site.mediaUrl ? '_blank' : undefined}
                rel="noopener noreferrer"
              >
                {/* Plain <img>: the badge is a runtime upload served by /api/files. */}
                <img
                  src={`/api/files/${site.mediaPath}`}
                  alt="نشان رسانه"
                  width={85}
                  height={95}
                  className={classes.badgeImg}
                />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={classes.wrap}>
        <div className={classes.copyBar}>
          © {site.siteName} — کلیه حقوق محفوظ است.
          <IconHeart
            size={13}
            stroke={1.6}
            style={{ color: 'var(--theme-primary)', verticalAlign: '-2px', marginInline: 4 }}
            aria-hidden="true"
          />
          طراحی شده با عشق
        </div>
      </div>
    </footer>
  );
}
