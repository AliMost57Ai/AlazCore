import { SimpleGrid } from '@mantine/core';
import { faNumber } from '@/lib/format';
import type { ProductDTO } from '@/lib/products';
import SectionHead from '../shared/SectionHead';
import ThemeProductCard from '../shared/ThemeProductCard';
import shared from '../shared/theme-shared.module.css';

export interface ProductGridProps {
  title: string;
  products: ProductDTO[];
}

/** DigiMarket product grid: a dense four-column wall of product cards. */
export default function ProductGrid({ title, products }: ProductGridProps) {
  return (
    <section id="productGrid" className={shared.section}>
      <div className={shared.wrap}>
        <SectionHead title={title} />
        {products.length === 0 ? (
          <p className={shared.empty}>محصولی برای نمایش وجود ندارد.</p>
        ) : (
          <SimpleGrid cols={{ base: 2, xs: 3, lg: 4 }} spacing={{ base: 'sm', sm: 'md' }}>
            {products.map((product) => (
              <ThemeProductCard key={product.id} product={product} />
            ))}
          </SimpleGrid>
        )}
        <p style={{ marginTop: 12, fontSize: 13, opacity: 0.6 }}>
          {faNumber(products.length)} محصول
        </p>
      </div>
    </section>
  );
}
