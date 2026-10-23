import type { CSSProperties, ReactNode } from 'react';
import type { SiteSettings } from '@/lib/theme-settings';
import classes from './theme-shared.module.css';

export interface FooterColumn {
  title: string;
  /** Plain link list, or free text (contact/about) — not both. */
  links?: { href: string; label: string }[];
  text?: string;
}

export interface ThemeFooterBaseProps {
  site: SiteSettings;
  columns: FooterColumn[];
  /** Extra content (e.g. social row) rendered under the columns. */
  extra?: ReactNode;
  /** The footer's themed look, set by each theme's footer. */
  style?: CSSProperties;
  /** Extra classes (each theme's module) layered on the shared scaffolding. */
  className?: string;
}

/**
 * The common footer skeleton: brand + admin-editable contact/about columns
 * + a copyright bar. Themes pass their own columns and colors; the about
 * text, phone, email, and address all come from مشخصات سایت.
 */
export default function ThemeFooterBase({
  site,
  columns,
  extra,
  style,
  className,
}: ThemeFooterBaseProps) {
  const contact: string[] = [];
  if (site.contactPhone) {
    contact.push(`تلفن: ${site.contactPhone}`);
  }
  if (site.contactEmail) {
    contact.push(`ایمیل: ${site.contactEmail}`);
  }
  if (site.contactAddress) {
    contact.push(`نشانی: ${site.contactAddress}`);
  }

  return (
    <footer className={className ? `${classes.footer} ${className}` : classes.footer} style={style}>
      <div className={classes.wrap}>
        <div className={classes.footerInner}>
          <div>
            <div className={classes.footerHead}>{site.siteName}</div>
            <p className={classes.footerText}>
              {site.aboutUs || 'فروشگاه اینترنتی — خرید آسان، ارسال سریع.'}
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <div className={classes.footerHead}>{column.title}</div>
              {column.links ? (
                <ul className={classes.footerList}>
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <a className={classes.footerLink} href={link.href}>
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={classes.footerText}>{column.text}</p>
              )}
            </div>
          ))}

          {contact.length > 0 ? (
            <div>
              <div className={classes.footerHead}>تماس با ما</div>
              <p className={classes.footerText}>{contact.join(' · ')}</p>
            </div>
          ) : null}

          {/* Trust badges (اینماد + رسانه) uploaded in مشخصات سایت — each
              theme's footer shows them next to the copyright bar. */}
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

        {extra}
      </div>

      <div className={classes.wrap}>
        <div className={classes.copyBar}>© {site.siteName} — تمامی حقوق محفوظ است.</div>
      </div>
    </footer>
  );
}
