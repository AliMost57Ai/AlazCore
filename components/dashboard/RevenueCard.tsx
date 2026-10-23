'use client';

import { useState } from 'react';
import { Badge, Card, Group, Select, Stack, Tabs, Text } from '@mantine/core';
import RevenueChart from '@/components/charts/RevenueChart';
import { enCurrency, enNumber } from '@/lib/format';
import type { MonthlyRevenue } from '@/lib/stats';

/**
 * Client component because `RevenueChart` takes formatter functions, and
 * functions cannot be serialised across the server/client boundary.
 * بازه‌ها و فریم سالانه همه سمت سرور محاسبه می‌شوند — تب/سال فقط انتخابند.
 */
export interface RevenueCardProps {
  monthly: MonthlyRevenue;
  daily: { label: string; value: number; hint?: string }[];
  weekly: { label: string; value: number; hint?: string }[];
}

type Range = 'daily' | 'weekly' | 'monthly';

/** واحد محور بر اساس بزرگ‌ترین مقدار سری — تیک خوانا در هر مقیاسی. */
function unitFor(max: number): { unitLabel: string; divisor: number } {
  if (max >= 1_000_000_000) {
    return { unitLabel: 'میلیارد تومان', divisor: 1_000_000_000 };
  }
  if (max >= 1_000_000) {
    return { unitLabel: 'میلیون تومان', divisor: 1_000_000 };
  }
  return { unitLabel: 'تومان', divisor: 1 };
}

const RANGES: Record<Range, { label: string; caption: string; maxLabels: number }> = {
  daily: { label: 'روز', caption: 'مبلغ فروش روزانه در ۳۰ روز گذشته', maxLabels: 6 },
  weekly: { label: 'هفته', caption: 'مبلغ فروش هفتگی در ۱۲ هفته گذشته', maxLabels: 6 },
  monthly: { label: 'ماه', caption: 'مبلغ فروش ماهانه در سال انتخابی', maxLabels: 12 },
};

export default function RevenueCard({ monthly, daily, weekly }: RevenueCardProps) {
  const [range, setRange] = useState<Range>('monthly');
  const [year, setYear] = useState<string | null>(
    monthly.years[0] != null ? String(monthly.years[0]) : null
  );

  const series =
    range === 'daily' ? daily : range === 'weekly' ? weekly : (monthly.byYear[year ?? ''] ?? []);
  const max = series.reduce((peak, point) => Math.max(peak, point.value), 0);
  const { unitLabel, divisor } = unitFor(max);

  return (
    <Card h="100%">
      <Group justify="space-between" align="flex-start" wrap="nowrap" mb="md" gap="xs">
        <Stack gap={2}>
          <Text fw={600}>روند درآمد</Text>
          <Text size="xs" c="dimmed">
            {RANGES[range].caption}
          </Text>
        </Stack>
        {monthly.growth >= 0 ? (
          <Badge variant="light" color="green" radius="sm">
            رشد ماهانه {enNumber(monthly.growth, 1)}٪
          </Badge>
        ) : (
          <Badge variant="light" color="red" radius="sm">
            افت ماهانه {enNumber(Math.abs(monthly.growth), 1)}٪
          </Badge>
        )}
      </Group>

      <Group justify="space-between" wrap="nowrap" gap="xs" mb="sm">
        <Tabs value={range} onChange={(value) => setRange((value as Range) ?? 'monthly')}>
          <Tabs.List>
            <Tabs.Tab value="daily">{RANGES.daily.label}</Tabs.Tab>
            <Tabs.Tab value="weekly">{RANGES.weekly.label}</Tabs.Tab>
            <Tabs.Tab value="monthly">{RANGES.monthly.label}</Tabs.Tab>
          </Tabs.List>
        </Tabs>
        {/* انتخاب سال فقط در نمای ماه معنا دارد. */}
        {range === 'monthly' && monthly.years.length > 0 ? (
          <Select
            size="xs"
            radius="md"
            w={110}
            data={monthly.years.map((value) => ({
              value: String(value),
              label: enNumber(value),
            }))}
            value={year}
            onChange={setYear}
            allowDeselect={false}
            aria-label="سال نمودار ماهانه"
          />
        ) : null}
      </Group>

      <RevenueChart
        data={series}
        unitLabel={unitLabel}
        // Ticks carry the bare number; the unit is stated once above the plot.
        formatTick={(value) => enNumber(value / divisor)}
        formatValue={(value) => enCurrency(value)}
        caption={RANGES[range].caption}
        maxLabels={RANGES[range].maxLabels}
      />
    </Card>
  );
}
