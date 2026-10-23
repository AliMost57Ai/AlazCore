'use client';

import { useState } from 'react';
import { IconBolt, IconMinus, IconPlus, IconShoppingCart, IconStack2 } from '@tabler/icons-react';
import {
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { applyDiscount, faCurrency, faNumber, faPercent } from '@/lib/format';
import type { ProductDTO } from '@/lib/products';
import { useShopCart } from './ShopCartProvider';
import classes from './ProductView.module.css';

export interface ProductViewProps {
  product: ProductDTO;
}

/**
 * The interactive part of the product page: gallery selection, variant
 * selection, quantity stepper. The page shell (metadata, breadcrumb, data
 * fetch) is the server component in page.tsx.
 */
export default function ProductView({ product }: ProductViewProps) {
  const cart = useShopCart();
  const [activeImage, setActiveImage] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(product.variants[0]?.id ?? null);
  const [qty, setQty] = useState(1);

  const variant = product.variants.find((item) => item.id === variantId) ?? null;

  // A variant may override the product price, and the product's discount
  // percent applies to whichever base price is in effect; its stock governs
  // availability.
  const basePrice = variant?.price ?? product.price;
  const effectivePrice = applyDiscount(basePrice, product.discountPercent);
  const stock = variant ? variant.qty : product.qty;
  const maxQty = Math.max(stock, 0);

  const images = product.images.map((image) => `/api/files/${image.path}`);

  function handleAddToCart() {
    cart.add({
      productId: product.id,
      variantId: variant?.id ?? null,
      slug: product.slug,
      name: product.name,
      variantName: variant?.name ?? null,
      unitPrice: effectivePrice,
      qty,
      maxStock: stock,
    });

    notifications.show({
      title: 'به سبد خرید افزوده شد',
      message: `${product.name}${variant ? ` — ${variant.name}` : ''} × ${faNumber(qty)}`,
      color: 'green',
      icon: <IconShoppingCart size={16} />,
    });
  }

  return (
    <div className={classes.main}>
      {/* Gallery */}
      <Box>
        <Card className={classes.gallery} p={0}>
          {images[activeImage] ? (
            /* Plain <img>: runtime-uploaded files served by /api/files, outside
               the Next image pipeline. */
            <img src={images[activeImage]} alt={product.name} className={classes.mainImage} />
          ) : (
            <div className={classes.noImage}>
              <IconBolt size={72} stroke={1.2} />
            </div>
          )}
        </Card>

        {images.length > 1 ? (
          <div className={classes.thumbs}>
            {images.map((src, index) => (
              <button
                key={src}
                type="button"
                className={`${classes.thumb} ${index === activeImage ? classes.thumbActive : ''}`}
                onClick={() => setActiveImage(index)}
                aria-label={`تصویر ${faNumber(index + 1)} از ${faNumber(images.length)}`}
                aria-pressed={index === activeImage}
              >
                {/* Plain <img> for runtime uploads, see the gallery above. */}
                <img src={src} alt="" className={classes.mainImage} />
              </button>
            ))}
          </div>
        ) : null}
      </Box>

      {/* Info + buy box */}
      <Stack gap="md">
        <Title order={1} fz={{ base: 'h3', sm: 'h2' }} lh={1.4}>
          {product.name}
        </Title>

        <Group gap="xs">
          {stock > 0 ? (
            <Badge variant="light" color="green" radius="sm" size="lg">
              {variant ? 'موجود در این نوع' : 'موجود'}
            </Badge>
          ) : (
            <Badge variant="light" color="gray" radius="sm" size="lg">
              ناموجود
            </Badge>
          )}
          {product.variants.length > 0 ? (
            <Badge
              variant="light"
              color="brand"
              radius="sm"
              size="lg"
              leftSection={<IconStack2 size={12} />}
            >
              {faNumber(product.variants.length)} نوع
            </Badge>
          ) : null}
        </Group>

        {/* Variant chips — a selected chip highlights and swaps price/stock. */}
        {product.variants.length > 0 ? (
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              انتخاب نوع
            </Text>
            <Group gap="xs">
              {product.variants.map((item) => (
                <Button
                  key={item.id}
                  variant={item.id === variantId ? 'filled' : 'default'}
                  size="xs"
                  radius="md"
                  onClick={() => {
                    setVariantId(item.id);
                    setQty(1);
                  }}
                  aria-pressed={item.id === variantId}
                  disabled={item.qty === 0}
                >
                  {item.name}
                  {item.price !== null && item.price !== product.price
                    ? ` (${faCurrency(applyDiscount(item.price, product.discountPercent), true)})`
                    : ''}
                </Button>
              ))}
            </Group>
          </Stack>
        ) : null}

        <Card className={classes.buyBox} withBorder={false}>
          <Stack gap="md">
            <div className={classes.priceRow}>
              <Text size="sm" c="dimmed">
                {variant && variant.price !== null ? 'قیمت نوع' : 'قیمت محصول'}
              </Text>
              <Group gap="xs" wrap="nowrap" align="baseline">
                {product.discountPercent > 0 ? (
                  <>
                    <Badge variant="filled" color="red" radius="sm" size="sm">
                      {faPercent(product.discountPercent, { fractionDigits: 0 })} تخفیف
                    </Badge>
                    <Text size="sm" c="dimmed" td="line-through">
                      {faCurrency(basePrice, false)}
                    </Text>
                  </>
                ) : null}
                <Text fz="xl" fw={800}>
                  {stock > 0 ? faCurrency(effectivePrice, false) : '—'}
                </Text>
              </Group>
            </div>

            <Group justify="space-between" wrap="nowrap">
              <Text size="sm" c="dimmed">
                تعداد
              </Text>
              <div className={classes.qtyStepper}>
                <button
                  type="button"
                  className={classes.qtyButton}
                  onClick={() => setQty((value) => Math.max(1, value - 1))}
                  disabled={qty <= 1}
                  aria-label="کاهش تعداد"
                >
                  <IconMinus size={16} />
                </button>
                <span className={classes.qtyValue}>{faNumber(qty)}</span>
                <button
                  type="button"
                  className={classes.qtyButton}
                  onClick={() => setQty((value) => Math.min(maxQty || 1, value + 1))}
                  disabled={stock === 0 || qty >= maxQty}
                  aria-label="افزایش تعداد"
                >
                  <IconPlus size={16} />
                </button>
              </div>
            </Group>

            <Button
              size="lg"
              leftSection={<IconShoppingCart size={18} />}
              onClick={handleAddToCart}
              disabled={stock === 0}
            >
              {stock > 0 ? 'افزودن به سبد خرید' : 'ناموجود'}
            </Button>

            {stock > 0 ? (
              <Text size="xs" c="dimmed" ta="center">
                {variant
                  ? `موجود در انبار: ${faNumber(stock)} عدد`
                  : `موجودی: ${faNumber(stock)} عدد`}
              </Text>
            ) : (
              <Text size="xs" c="dimmed" ta="center">
                این محصول در حال حاضر موجود نیست.
              </Text>
            )}
          </Stack>
        </Card>

        {product.props.length > 0 ? (
          <>
            <Divider label="مشخصات" labelPosition="center" mt="sm" />
            <Card>
              {product.props.map((prop) => (
                <div key={`${prop.key}-${prop.value}`} className={classes.specRow}>
                  <span className={classes.specKey}>{prop.key}</span>
                  <Text size="sm">{prop.value}</Text>
                </div>
              ))}
            </Card>
          </>
        ) : null}

        <Anchor href="/" size="sm" c="brand" ta="center">
          بازگشت به فروشگاه
        </Anchor>
      </Stack>
    </div>
  );
}
