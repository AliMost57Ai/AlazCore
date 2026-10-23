import SectionHead from '../shared/SectionHead';
import shared from '../shared/theme-shared.module.css';
import type { BrandChip } from '@/lib/brands';
import classes from './digimarket.module.css';

export interface BrandCarouselProps {
  title: string;
  /** برندهای فعال تعریف‌شده در بک‌آفیس — بدون برند کل بخش مخفی می‌شود. */
  brands: BrandChip[];
}

/**
 * DigiMarket brand carousel: a horizontally scrollable chip row (native
 * overflow scrolling keeps it dependency-free and touch friendly). Chips are
 * the real Brand entities (/brands) and link to the storefront brand filter
 * /?brand=slug — hidden entirely when the store has no active brand.
 */
export default function BrandCarousel({ title, brands }: BrandCarouselProps) {
  if (brands.length === 0) {
    return null;
  }

  return (
    <section id="brandCarousel" className={shared.section}>
      <div className={shared.wrap}>
        <SectionHead title={title} />
        <div className={classes.brandScroller}>
          {brands.map((brand) => (
            <a
              key={brand.id}
              className={classes.brandChip}
              href={`/?brand=${encodeURIComponent(brand.slug)}`}
            >
              <span className={classes.brandDot} aria-hidden="true" />
              {brand.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
