import { SimpleGrid } from '@mantine/core';
import type { CategoryDTO } from '@/lib/categories';
import { faNumber } from '@/lib/format';
import SectionHead from '../shared/SectionHead';
import shared from '../shared/theme-shared.module.css';
import classes from './softkala.module.css';

export interface CategoryFeatureProps {
  title: string;
  /** The REAL category tree — the two most-stocked groups star as features. */
  categories: CategoryDTO[];
}

/**
 * SoftKala category feature ("Top Cases" / "Selected Graphics Cards" on the
 * demo site): two wide dark cards featuring a hardware category each. Since
 * Batch L the cards are REAL — the store's top categories with live product
 * counts, deep-linking into the category filter — hidden when empty.
 */
export default function CategoryFeature({ title, categories }: CategoryFeatureProps) {
  const features = [...categories]
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 2)
    .map((category, index) => ({
      id: category.id,
      tag: index === 0 ? 'FEATURED' : 'HANDPICKED',
      heading: category.name,
      count: category.productCount,
    }));

  if (features.length === 0) {
    return null;
  }

  return (
    <section id="categoryFeature" className={shared.section}>
      <div className={shared.wrap}>
        <SectionHead title={title} />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {features.map((feature) => (
            <a key={feature.id} className={classes.featureCard} href={`/?category=${feature.id}`}>
              <span className={classes.featureTag}>{feature.tag}</span>
              <h3 className={classes.featureTitle}>{feature.heading}</h3>
              <span className={classes.featureCount}>{faNumber(feature.count)} کالا</span>
            </a>
          ))}
        </SimpleGrid>
      </div>
    </section>
  );
}
