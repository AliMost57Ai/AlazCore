'use client';

import {
  IconCreditCard,
  IconShoppingCart,
  IconTrendingDown,
  IconTrendingUp,
  IconUsers,
} from '@tabler/icons-react';
import { Card, Group, SimpleGrid, Text, ThemeIcon } from '@mantine/core';
import Sparkline from '@/components/charts/Sparkline';
import { faCurrency, faNumber, faPercent } from '@/lib/format';
import type { StatTile } from '@/lib/stats';
import classes from './StatsGrid.module.css';

/**
 * lib/stats.ts is server-side, so `StatTile.icon` carries a string key; the
 * component references themselves live here (they cannot cross the RSC
 * boundary as props).
 */
const ICONS: Record<StatTile['icon'], typeof IconUsers> = {
  'credit-card': IconCreditCard,
  'shopping-cart': IconShoppingCart,
  users: IconUsers,
  'trending-up': IconTrendingUp,
};

function formatValue(tile: StatTile): string {
  switch (tile.format) {
    case 'currency':
      return faCurrency(tile.value);
    case 'percent':
      return faPercent(tile.value);
    default:
      return faNumber(tile.value);
  }
}

export interface StatsGridProps {
  tiles: StatTile[];
}

export default function StatsGrid({ tiles }: StatsGridProps) {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing={{ base: 'sm', sm: 'md' }}>
      {tiles.map((tile) => {
        const rising = tile.delta > 0;
        // Direction alone doesn't say good or bad — churn falling is good.
        const isGood = rising === tile.upIsGood;
        const DeltaIcon = rising ? IconTrendingUp : IconTrendingDown;
        const TileIcon = ICONS[tile.icon];

        return (
          <Card key={tile.key} className={classes.card}>
            <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
              <div className={classes.body}>
                <Text size="sm" c="dimmed" lh={1.4}>
                  {tile.label}
                </Text>
                <Text className={classes.value}>{formatValue(tile)}</Text>
              </div>

              {/* The icon tile from the samples: w-10 h-10 rounded-xl on a
                  brand wash — one size up from Mantine's default 38. */}
              <ThemeIcon variant="light" color="brand" size={40} radius={12}>
                <TileIcon size={20} stroke={1.7} />
              </ThemeIcon>
            </Group>

            <Group justify="space-between" wrap="nowrap" mt="md" gap="xs">
              {/* Icon + label carry the meaning; colour only reinforces it. */}
              <Group gap={4} wrap="nowrap" className={isGood ? classes.good : classes.bad}>
                <DeltaIcon size={16} stroke={2} />
                <Text size="sm" fw={600} className={classes.deltaValue}>
                  {faPercent(Math.abs(tile.delta), { signed: false })}
                </Text>
              </Group>

              <Sparkline data={tile.trend} label={`روند ${tile.label}`} />
            </Group>

            <Text size="xs" c="dimmed" mt={6}>
              نسبت به ماه گذشته
            </Text>
          </Card>
        );
      })}
    </SimpleGrid>
  );
}
