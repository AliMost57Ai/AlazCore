import { IconBolt } from '@tabler/icons-react';
import { Image } from '@mantine/core';
import { isOversellEnabled } from '@/lib/core-license';
import { applyDiscount, faNumber, faPercent } from '@/lib/format';
import { oversellDisplayState } from '@/lib/oversell-display';
import type { ProductDTO } from '@/lib/products';
import FavoriteButton from '@/components/shop/FavoriteButton';
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
 * The whole card links to the product's shop page. کالای خالی‌فروشِ فروشگاهی
 * که Core برایش خالی‌فروشی فعال کرده به‌جای «ناموجود» برچسب
 * «تنها ۱ عدد باقی مانده» می‌گیرد و قیمتش پنهان نمی‌شود.
 */
export default async function ProductCard({ product, categoryName }: ProductCardProps) {
  const image = product.images[0];
  const inStock = product.qty > 0;
  // قرارداد واحد وضعیت ویترین — رسیدن کسری خالی‌فروشی به سقف کالا یعنی
  // «ناموجود».
  const oversell =
    oversellDisplayState({
      stock: product.qty,
      oversellAllowed: product.oversellAllowed,
      oversellMax: product.oversellMax,
      oversellEnabled: await isOversellEnabled(),
    }) === 'oversell';
  const purchasable = inStock || oversell;
  const finalPrice = applyDiscount(product.price, product.discountPercent);

  return (
    // پوسته قلب — بیرون anchorِ کارت (anchor تو در تو نامعتبر است).
    <div className={classes.cardWrap}>
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
      {product.brandName ? <span className={classes.cardBrand}>{product.brandName}</span> : null}

      <div className={classes.cardPriceRow}>
        {purchasable ? (
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
      {oversell ? <span className={classes.cardOut}>تنها ۱ عدد باقی مانده</span> : null}
    </a>
      <div className={classes.cardFav}>
        <FavoriteButton productId={product.id} productName={product.name} size="sm" />
      </div>
    </div>
  );
}
