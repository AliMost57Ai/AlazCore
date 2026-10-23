import { SimpleGrid, Stack } from '@mantine/core';
import { faJalaliDate } from '@/lib/format';
import type { ProductDTO } from '@/lib/products';
import SectionHead from '../shared/SectionHead';
import shared from '../shared/theme-shared.module.css';
import classes from './digishop.module.css';

export interface MagazineTeaserProps {
  title: string;
  /** Real products — newest first — become the teaser cards. */
  products: ProductDTO[];
}

/**
 * DigiShop magazine teaser: compact cards teasing the catalog. Since Batch L
 * the cards are REAL — the newest products, linked to their shop pages with
 * their actual Jalali dates — hidden when the catalog is empty.
 */
export default function MagazineTeaser({ title, products }: MagazineTeaserProps) {
  const articles = products.slice(0, 2);

  if (articles.length === 0) {
    return null;
  }

  return (
    <section id="magazine" className={shared.section}>
      <div className={shared.wrap}>
        <SectionHead title={title} />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {articles.map((article) => (
            <a key={article.id} className={classes.magCard} href={`/shop/${article.slug}`}>
              <span className={classes.magCover} aria-hidden="true">
                ✨
              </span>
              <Stack gap={4}>
                <h3 className={classes.magTitle}>{article.name}</h3>
                <p className={classes.magText}>
                  تازه رسیده — {faJalaliDate(new Date(article.createdAt))}
                </p>
              </Stack>
            </a>
          ))}
        </SimpleGrid>
      </div>
    </section>
  );
}
