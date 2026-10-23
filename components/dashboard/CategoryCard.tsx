'use client';

import { useState } from 'react';
import { Card, Stack, Tabs, Text } from '@mantine/core';
import CategoryBars from '@/components/charts/CategoryBars';
import { enCurrency } from '@/lib/format';
import type { SalesBreakdown } from '@/lib/stats';

/**
 * Client component for the same reason as `RevenueCard`: formatter props.
 * یک باکس، سه نگاه به فروش واقعی: دسته‌بندی کالا (جمع خطوط اقلام)،
 * تحویل حضوری (نقطه مراجعه) و انواع ارسال (روش فاکتور) — همه به تومان.
 */
export interface CategoryCardProps {
  breakdown: SalesBreakdown;
}

type View = keyof SalesBreakdown;

const VIEWS: Record<View, { label: string; caption: string }> = {
  categories: { label: 'دسته‌بندی کالا', caption: 'مبلغ فروش به تفکیک دسته‌بندی کالا' },
  pickupLocations: { label: 'تحویل حضوری', caption: 'مبلغ فروش تحویل حضوری به تفکیک نقطه مراجعه' },
  deliveryMethods: { label: 'انواع ارسال', caption: 'مبلغ فروش به تفکیک روش ارسال' },
};

export default function CategoryCard({ breakdown }: CategoryCardProps) {
  const [view, setView] = useState<View>('categories');
  const series = breakdown[view];

  return (
    <Card h="100%">
      <Stack gap={2} mb="xs">
        <Text fw={600}>فروش بر پایه…</Text>
        <Text size="xs" c="dimmed">
          سفارش‌های پرداخت‌شده به بعد
        </Text>
      </Stack>

      <Tabs
        value={view}
        onChange={(value) => setView((value as View) ?? 'categories')}
        mb="sm"
        variant="pills"
        radius="sm"
      >
        <Tabs.List>
          {(Object.keys(VIEWS) as View[]).map((key) => (
            <Tabs.Tab key={key} value={key} fz="xs">
              {VIEWS[key].label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <CategoryBars
        data={series}
        formatValue={(value) => enCurrency(value)}
        caption={`${VIEWS[view].caption} — سفارش‌های پرداخت‌شده به بعد`}
      />
    </Card>
  );
}
