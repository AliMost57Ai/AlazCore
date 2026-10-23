import shared from '../shared/theme-shared.module.css';
import classes from './beautyshop.module.css';

export interface HeroSliderProps {
  /** Admin-editable heading from the theme customizer. */
  title: string;
  /** The store's real name + product count — real data since Batch L. */
  siteName: string;
  productCount: number;
}

/**
 * BeautyShop hero: the theme's signature gradient band with a tag chip, the
 * (admin-editable) headline, a CTA into the best-sellers grid, and
 * decorative slider dots — the demo site's HeroSlider as a single slide.
 * The supporting line is real data (store name + live product count).
 */
export default function HeroSlider({ title, siteName, productCount }: HeroSliderProps) {
  return (
    <div className={shared.wrap}>
      <div className={classes.hero}>
        <span className={classes.heroTag}>جدیدترین‌های این فصل</span>
        <h1 className={classes.heroTitle}>{title}</h1>
        <p className={classes.heroText}>
          {siteName} — {productCount > 0 ? `${productCount} کالای اورجینال` : 'کالاهای اورجینال'} با
          ارسال سریع و ضمانت اصالت.
        </p>
        <a className={classes.heroCta} href="#bestSellers">
          مشاهده محصولات
        </a>
        <div className={classes.dots} aria-hidden="true">
          <span className={classes.dotActive} />
          <span className={classes.dot} />
          <span className={classes.dot} />
        </div>
      </div>
    </div>
  );
}
