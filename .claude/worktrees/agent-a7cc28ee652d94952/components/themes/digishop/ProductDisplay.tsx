import { SimpleGrid } from '@mantine/core';
import { faNumber } from '@/lib/format';
import type { ProductDTO } from '@/lib/products';
import ProductCard from './ProductCard';
import shared from '../shared/theme-shared.module.css';
import classes from './digishop.module.css';

export interface ProductDisplayProps {
  title: string;
  products: ProductDTO[];
  /** productId → first category name (the green tag on each card). */
  categoryNames: Record<string, string>;
}

/** DigiShop product grid: the design's red-bar heading + spec-exact cards. */
export default function ProductDisplay({ title, products, categoryNames }: ProductDisplayProps) {
  const shown = products.filter((product) => product.qty > 0).slice(0, 12);

  return (
    <section id="productDisplay" className={shared.section}>
      <div className={classes.wrap}>
        <div className={classes.gridHead}>
          <h2 className={classes.gridTitle}>
            <span className={classes.gridTitleBar} aria-hidden="true" />
            {title}
          </h2>
          <span className={classes.gridCount}>{faNumber(shown.length)} محصول</span>
        </div>
        {shown.length === 0 ? (
          <p className={shared.empty}>محصولی برای نمایش وجود ندارد.</p>
        ) : (
          <SimpleGrid cols={{ base: 2, xs: 3, md: 4, xl: 6 }} spacing={{ base: 'sm', md: 'md' }}>
            {shown.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                categoryName={categoryNames[product.id]}
              />
            ))}
          </SimpleGrid>
        )}
      </div>
    </section>
  );
}
