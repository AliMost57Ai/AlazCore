import type { ComponentType } from 'react';
import {
  IconDiamond,
  IconGift,
  IconHeart,
  IconShoppingBag,
  IconSparkles,
  type IconProps,
} from '@tabler/icons-react';
import type { CategoryDTO } from '@/lib/categories';
import { treeForSection } from '@/lib/section-placements';
import shared from '../shared/theme-shared.module.css';
import classes from './digishop.module.css';

export interface GiftIdeaGridProps {
  title: string;
  /** The category tree — top-level groups become the finder tiles. */
  categories: CategoryDTO[];
  /** categoryId → pinned section ids for the ACTIVE theme. */
  categorySections: Record<string, string[]>;
}

/** Decorative tile icons, rotated across the tiles (no per-category icon data). */
const TILE_ICONS: ComponentType<IconProps>[] = [
  IconGift,
  IconHeart,
  IconDiamond,
  IconSparkles,
  IconShoppingBag,
];

/**
 * DigiShop gift finder («هدیه چی بدم؟!»): the design's white card of circular
 * category tiles — each links to that category's filtered storefront view.
 * Hidden entirely when the store has no categories.
 */
export default function GiftIdeaGrid({ title, categories, categorySections }: GiftIdeaGridProps) {
  const groups = treeForSection(categories, 'giftIdeas', categorySections).slice(0, 5);

  if (groups.length === 0) {
    return null;
  }

  return (
    <section id="giftIdeas" className={shared.section}>
      <div className={classes.wrap}>
        <div className={classes.finderCard}>
          <div className={classes.finderHead}>
            <span className={classes.finderKicker}>راهنمای انتخاب هوشمند</span>
            <h2 className={classes.finderTitle}>{title}</h2>
            <p className={classes.finderText}>
              محصولات هر دسته را با یک کلیک ببینید و برای هر سلیقه‌ای هدیه پیدا کنید
            </p>
          </div>
          <div className={classes.finderGrid}>
            {groups.map((group, index) => {
              const Icon = TILE_ICONS[index % TILE_ICONS.length];
              return (
                <a
                  key={group.id}
                  className={classes.finderTile}
                  href={`/?category=${encodeURIComponent(group.id)}`}
                >
                  <span
                    className={
                      index % 2 === 1
                        ? `${classes.finderBubble} ${classes.finderBubbleAlt}`
                        : classes.finderBubble
                    }
                    aria-hidden="true"
                  >
                    <Icon size={32} stroke={1.4} />
                  </span>
                  <h3 className={classes.finderName}>{group.name}</h3>
                  <span className={classes.finderPill}>
                    {group.productCount > 0 ? 'مشاهده محصولات' : 'به‌زودی'}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
