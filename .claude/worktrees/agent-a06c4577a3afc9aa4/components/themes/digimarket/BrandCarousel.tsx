import SectionHead from '../shared/SectionHead';
import shared from '../shared/theme-shared.module.css';
import classes from './digimarket.module.css';

export interface BrandCarouselProps {
  title: string;
  /** Distinct real brands found in the catalog's product names. */
  brands: string[];
}

/**
 * DigiMarket brand carousel: a horizontally scrollable chip row (native
 * overflow scrolling keeps it dependency-free and touch friendly). Since
 * Batch L the chips are real: the distinct brands appearing in the store's
 * actual product names — hidden entirely when the catalog has none.
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
            <a key={brand} className={classes.brandChip} href={`/?q=${encodeURIComponent(brand)}`}>
              <span className={classes.brandDot} aria-hidden="true" />
              {brand}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
