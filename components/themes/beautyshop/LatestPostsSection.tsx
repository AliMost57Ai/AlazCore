import { SimpleGrid } from '@mantine/core';
import { faJalaliDate } from '@/lib/format';
import type { ProductDTO } from '@/lib/products';
import SectionHead from '../shared/SectionHead';
import shared from '../shared/theme-shared.module.css';
import classes from './beautyshop.module.css';

export interface LatestPostsSectionProps {
  title: string;
  /** Real products — newest first — power the magazine cards. */
  products: ProductDTO[];
}

/**
 * BeautyShop magazine section (LatestPostsSection on the demo site): three
 * editorial cards. Since Batch L the cards are REAL data — the newest
 * products, linked to their shop pages, with their actual Jalali dates —
 * instead of hardcoded demo copy.
 */
export default function LatestPostsSection({ title, products }: LatestPostsSectionProps) {
  const posts = products.slice(0, 3);

  return (
    <section id="latestPosts" className={shared.section}>
      <div className={shared.wrap}>
        <SectionHead title={title} />
        {posts.length === 0 ? (
          <p className={shared.empty}>محتوایی برای نمایش وجود ندارد.</p>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            {posts.map((post, index) => (
              <article key={post.id} className={classes.postCard}>
                <div className={index % 2 === 0 ? classes.postCover : classes.postCoverAlt} />
                <div className={classes.postBody}>
                  <span className={classes.postDate}>{faJalaliDate(new Date(post.createdAt))}</span>
                  <h3 className={classes.postTitle}>{post.name}</h3>
                  <a className={classes.postMore} href={`/shop/${post.slug}`}>
                    مشاهده کالا ←
                  </a>
                </div>
              </article>
            ))}
          </SimpleGrid>
        )}
      </div>
    </section>
  );
}
