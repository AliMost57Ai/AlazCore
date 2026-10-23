'use client';

import { Badge, Card, Group, Stack, Text } from '@mantine/core';
import RevenueChart from '@/components/charts/RevenueChart';
import { faCurrency, faNumber } from '@/lib/format';
import type { SeriesPoint } from '@/lib/stats';

/**
 * Client component because `RevenueChart` takes formatter functions, and
 * functions cannot be serialised across the server/client boundary.
 */
export interface RevenueCardProps {
  series: SeriesPoint[];
  /** Growth vs. previous period, in percent — computed server-side. */
  growth: number;
}

export default function RevenueCard({ series, growth }: RevenueCardProps) {
  return (
    <Card h="100%">
      <Group justify="space-between" align="flex-start" wrap="nowrap" mb="md" gap="xs">
        <Stack gap={2}>
          <Text fw={600}>روند درآمد</Text>
          <Text size="xs" c="dimmed">
            دوازده ماه گذشته
          </Text>
        </Stack>
        {growth >= 0 ? (
          <Badge variant="light" color="green" radius="sm">
            رشد {faNumber(growth, 1)}٪
          </Badge>
        ) : (
          <Badge variant="light" color="red" radius="sm">
            افت {faNumber(Math.abs(growth), 1)}٪
          </Badge>
        )}
      </Group>

      <RevenueChart
        data={series}
        unitLabel="میلیارد تومان"
        // Ticks carry the bare number; the unit is stated once above the plot.
        formatTick={(value) => faNumber(value / 1_000_000_000)}
        formatValue={(value) => faCurrency(value)}
        caption="درآمد ماهانه در دوازده ماه گذشته"
      />
    </Card>
  );
}
