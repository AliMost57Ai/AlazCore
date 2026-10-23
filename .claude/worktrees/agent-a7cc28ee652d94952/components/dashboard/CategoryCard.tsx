'use client';

import { Card, Stack, Text } from '@mantine/core';
import CategoryBars from '@/components/charts/CategoryBars';
import { faNumber } from '@/lib/format';
import type { SeriesPoint } from '@/lib/stats';

/** Client component for the same reason as `RevenueCard`: formatter props. */
export interface CategoryCardProps {
  series: SeriesPoint[];
}

export default function CategoryCard({ series }: CategoryCardProps) {
  return (
    <Card h="100%">
      <Stack gap={2} mb="md">
        <Text fw={600}>فروش بر پایه دسته‌بندی</Text>
        <Text size="xs" c="dimmed">
          تعداد سفارش در ماه جاری
        </Text>
      </Stack>

      <CategoryBars
        data={series}
        formatValue={(value) => faNumber(value)}
        caption="تعداد سفارش به تفکیک دسته‌بندی در ماه جاری"
      />
    </Card>
  );
}
