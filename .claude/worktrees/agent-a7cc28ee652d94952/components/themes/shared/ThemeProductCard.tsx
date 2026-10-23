import { IconBolt } from '@tabler/icons-react';
import { Image } from '@mantine/core';
import { applyDiscount, faCurrency, faPercent } from '@/lib/format';
import type { ProductDTO } from '@/lib/products';
import classes from './theme-shared.module.css';

export interface ThemeProductCardProps {
  product: ProductDTO;
  /** Dense themes (SoftKala) use a smaller image + tighter body. */
  compact?: boolean;
}

/**
 * The storefront product card shared by every theme's product section —
 * image (or brand placeholder), name, discount-aware price, stock label.
 * Colors come from the active theme's CSS variables.
 */
export default function ThemeProductCard({ product, compact = false }: ThemeProductCardProps) {
  const image = product.images[0];
  const finalPrice = applyDiscount(product.price, product.discountPercent);

  return (
    <a className={classes.card} href={`/shop/${product.slug}`}>
      <div className={compact ? classes.cardImageCompact : classes.cardImage}>
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

      <p className={classes.cardTitle}>{product.name}</p>

      <div className={classes.priceRow}>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
          {product.qty > 0 ? (
            <>
              {product.discountPercent > 0 ? (
                <>
                  <span className={classes.discountBadge}>
                    {faPercent(product.discountPercent, { fractionDigits: 0 })}
                  </span>
                  <span className={classes.oldPrice}>{faCurrency(product.price, false)}</span>
                </>
              ) : null}
              <span className={classes.price}>{faCurrency(finalPrice, false)}</span>
            </>
          ) : (
            <span className={classes.price}>—</span>
          )}
        </span>

        <span className={product.qty > 0 ? classes.stockIn : classes.stockOut}>
          {product.qty > 0 ? 'موجود' : 'ناموجود'}
        </span>
      </div>
    </a>
  );
}
