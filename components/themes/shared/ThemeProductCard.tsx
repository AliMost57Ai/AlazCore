import { IconBolt } from '@tabler/icons-react';
import { Image } from '@mantine/core';
import { isOversellEnabled } from '@/lib/core-license';
import { applyDiscount, faCurrency, faPercent } from '@/lib/format';
import { oversellDisplayState } from '@/lib/oversell-display';
import type { ProductDTO } from '@/lib/products';
import FavoriteButton from '@/components/shop/FavoriteButton';
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
 *
 * کالای خالی‌فروشِ فروشگاهی که Core برایش خالی‌فروشی فعال کرده به‌جای
 * «ناموجود» برچسب «تنها ۱ عدد باقی مانده» می‌گیرد و قیمتش پنهان نمی‌شود.
 */
export default async function ThemeProductCard({
  product,
  compact = false,
}: ThemeProductCardProps) {
  const image = product.images[0];
  const finalPrice = applyDiscount(product.price, product.discountPercent);
  // قرارداد واحد وضعیت ویترین — رسیدن کسری خالی‌فروشی به سقف کالا یعنی
  // «ناموجود» (نمایش در سایت خاموش یعنی اصلاً در لیست‌ها نمی‌آید).
  const display = oversellDisplayState({
    stock: product.qty,
    oversellAllowed: product.oversellAllowed,
    oversellMax: product.oversellMax,
    oversellEnabled: await isOversellEnabled(),
  });
  const oversell = display === 'oversell';
  const purchasable = display !== 'sold_out';

  return (
    // پوسته نسبتاً-موقعیت‌دار — قلب علاقه‌مندی بیرون از anchor می‌نشیند
    // (anchor تو در تو و button داخل a هر دو نامعتبرند).
    <div className={classes.cardWrap}>
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

      {/* برند به‌صورت متن ساده — کل کارت لینک است و anchor تو در تو مجاز نیست. */}
      {product.brandName ? (
        <p className={classes.cardBrand}>{product.brandName}</p>
      ) : null}

      <div className={classes.priceRow}>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
          {purchasable ? (
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

        <span className={purchasable ? classes.stockIn : classes.stockOut}>
          {product.qty > 0 ? 'موجود' : oversell ? 'تنها ۱ عدد باقی مانده' : 'ناموجود'}
        </span>
      </div>
      </a>
      <div className={classes.cardFav}>
        <FavoriteButton productId={product.id} productName={product.name} size="sm" />
      </div>
    </div>
  );
}
