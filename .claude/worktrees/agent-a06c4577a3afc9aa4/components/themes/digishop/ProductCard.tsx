import { IconBolt } from '@tabler/icons-react';
import { Image } from '@mantine/core';
import { applyDiscount, faNumber, faPercent } from '@/lib/format';
import type { ProductDTO } from '@/lib/products';
import classes from './digishop.module.css';

export interface ProductCardProps {
  product: ProductDTO;
  /** The product's first category name — becomes the green tag + label. */
  categoryName?: string;
}

/**
 * The DigiShop product card, built to the design spec: square image plate,
 * red discount pill (top-left), green category tag (top-right), 2-line
 * 13px title, strikethrough old price + bold price with an 11px «تومان».
 * The whole card links to the product's shop page.
 */
export default function ProductCard({ product, categoryName }: ProductCardProps) {
  const image = product.images[0];
  const inStock = product.qty > 0;
  const finalPrice = applyDiscount(product.price, product.discountPercent);

  return (
    <a className={classes.card} href={`/shop/${product.slug}`}>
      <div className={classes.cardMedia}>
        {product.discountPercent > 0 ? (
          <span className={classes.cardDiscount}>
            {faPercent(product.discountPercent, { fractionDigits: 0 })}-
          </span>
        ) : null}
        {categoryName ? <span className={classes.cardTag}>{categoryName}</span> : null}
        {image ? (
          <Image
            src={`/api/files/${image.path}`}
            alt={product.name}
            h="100%"
            w="auto"
            fit="contain"
          />
        ) : (
          <IconBolt size={36} stroke={1.4} opacity={0.35} />
        )}
      </div>

      {categoryName ? <span className={classes.cardCat}>{categoryName}</span> : null}
      <p className={classes.cardTitle}>{product.name}</p>

      <div className={classes.cardPriceRow}>
        {inStock ? (
          <>
            {product.discountPercent > 0 ? (
              <span className={classes.cardOldPrice}>{faNumber(product.price)} تومان</span>
            ) : null}
            <span>
              <span className={classes.cardPrice}>{faNumber(finalPrice)}</span>
              <span className={classes.cardToman}>تومان</span>
            </span>
          </>
        ) : (
          <span className={classes.cardOut}>ناموجود</span>
        )}
      </div>
    </a>
  );
}
