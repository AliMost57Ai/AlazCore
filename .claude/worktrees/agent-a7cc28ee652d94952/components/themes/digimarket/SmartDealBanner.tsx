import { applyDiscount, faCurrency } from '@/lib/format';
import type { ProductDTO } from '@/lib/products';
import shared from '../shared/theme-shared.module.css';
import classes from './digimarket.module.css';

export interface SmartDealBannerProps {
  title: string;
  /** The deepest-discounted in-stock product becomes the deal's hero item. */
  products: ProductDTO[];
}

/**
 * DigiMarket smart-deal banner: accent-yellow strip promoting the current
 * top-discount product (falls back to a generic CTA when nothing is on sale).
 */
export default function SmartDealBanner({ title, products }: SmartDealBannerProps) {
  const deal = [...products]
    .filter((product) => product.qty > 0 && product.discountPercent > 0)
    .sort((a, b) => b.discountPercent - a.discountPercent)[0];

  return (
    <div className={shared.wrap}>
      <div className={classes.deal}>
        <div>
          <h2 className={classes.dealTitle}>{title}</h2>
          <p className={classes.dealText}>
            {deal
              ? `${deal.name} — ${faCurrency(applyDiscount(deal.price, deal.discountPercent), false)} تومان`
              : 'تخفیف‌های ویژه این هفته را از دست ندهید.'}
          </p>
        </div>
        <a className={classes.dealCta} href={deal ? `/shop/${deal.slug}` : '#productGrid'}>
          {deal ? 'خرید با تخفیف' : 'مشاهده محصولات'}
        </a>
      </div>
    </div>
  );
}
