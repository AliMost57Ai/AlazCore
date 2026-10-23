import { IconArrowLeft, IconPercentage } from '@tabler/icons-react';
import type { ProductDTO } from '@/lib/products';
import { itemsForSection } from '@/lib/section-placements';
import ProductCard from './ProductCard';
import shared from '../shared/theme-shared.module.css';
import classes from './digishop.module.css';

export interface AmazingDealsProps {
  title: string;
  /** Top-discount, in-stock products become the deal cards. */
  products: ProductDTO[];
  /** productId → first category name (the green tag on each card). */
  categoryNames: Record<string, string>;
  /** Section pins for the ACTIVE theme (Batch M point 4). */
  productSections: Record<string, string[]>;
}

/**
 * DigiShop «پیشنهاد شگفت‌انگیز»: the design's red deal panel — a header block
 * (percent badge, headline, «مشاهده همه») beside a grid of the catalog's
 * deepest discounts. When nothing is on sale it falls back to the newest
 * in-stock products (same cards, no discount pills) so the storefront keeps
 * its marquee section.
 */
export default function AmazingDeals({
  title,
  products,
  categoryNames,
  productSections,
}: AmazingDealsProps) {
  const candidates = itemsForSection(products, 'amazingDeals', productSections);
  const discounted = candidates
    .filter((product) => product.qty > 0 && product.discountPercent > 0)
    .sort((a, b) => b.discountPercent - a.discountPercent);
  const deals =
    discounted.length > 0
      ? discounted.slice(0, 5)
      : [...candidates]
          .filter((product) => product.qty > 0)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 5);

  if (deals.length === 0) {
    return null;
  }

  return (
    <section id="amazingDeals" className={shared.section}>
      <div className={classes.wrap}>
        <div className={classes.dealsPanel}>
          <div className={classes.dealsHead}>
            <span className={classes.dealsIcon} aria-hidden="true">
              <IconPercentage size={40} stroke={1.4} />
            </span>
            <h2 className={classes.dealsTitle}>{title}</h2>
            <p className={classes.dealsText}>
              {discounted.length > 0 ? 'فرصت محدود خرید با تخفیف ویژه' : 'جدیدترین محصولات فروشگاه'}
            </p>
            <a className={classes.dealsAll} href="#productDisplay">
              مشاهده همه
              <IconArrowLeft size={14} stroke={1.8} aria-hidden="true" />
            </a>
          </div>
          <div className={classes.dealsGrid}>
            {deals.map((deal) => (
              <ProductCard key={deal.id} product={deal} categoryName={categoryNames[deal.id]} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
