import { SimpleGrid } from '@mantine/core';
import type { CategoryDTO } from '@/lib/categories';
import { faNumber } from '@/lib/format';
import SectionHead from '../shared/SectionHead';
import shared from '../shared/theme-shared.module.css';
import classes from './digimarket.module.css';

export interface CategoryGridProps {
  title: string;
  /** The REAL category tree — each group becomes a tile. */
  categories: CategoryDTO[];
}
/**
 * DigiMarket category grid: tiles deep-linking into the catalog. Since Batch L
 * the tiles are the store's real category groups (with live product counts)
 * instead of hardcoded demo labels — hidden entirely when no group exists.
 */
export default function CategoryGrid({ title, categories }: CategoryGridProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <section id="categoryGrid" className={shared.section}>
      <div className={shared.wrap}>
        <SectionHead title={title} />
        <SimpleGrid cols={{ base: 3, xs: 4, sm: 6 }} spacing="sm">
          {categories.map((category) => (
            <a
              key={category.id}
              className={classes.categoryTile}
              href={`/?category=${category.id}`}
            >
              <span className={classes.categoryIcon} aria-hidden="true">
                ◆
              </span>
              {category.name}
              <span className={classes.categoryCount}>{faNumber(category.productCount)} کالا</span>
            </a>
          ))}
        </SimpleGrid>
      </div>
    </section>
  );
}
