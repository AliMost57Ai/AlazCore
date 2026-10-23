'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { IconAlertTriangle, IconListDetails, IconPackages } from '@tabler/icons-react';
import { Card, Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';

export interface StockTiles {
  reorder: number;
  lowStock: number;
  oversold: number;
}

/**
 * سه باکس موجودی داشبورد + نوتیفیکیشن مدیر: نقطه سفارش (لیست خرید)، رو به
 * اتمام (حداقل موجودی) و مجموع خالی‌فروشی. اعلان‌ها یک بار در ورود به
 * داشبورد صادر می‌شوند.
 */
export default function StockAlertBoxes({ tiles }: { tiles: StockTiles }) {
  useEffect(() => {
    if (tiles.reorder > 0) {
      notifications.show({
        title: 'نقطه سفارش',
        message: `${new Intl.NumberFormat('fa-IR').format(tiles.reorder)} کالا به نقطه سفارش رسیده است — لیست خرید را ببینید.`,
        color: 'blue',
      });
    }
    if (tiles.lowStock > 0) {
      notifications.show({
        title: 'رو به اتمام',
        message: `${new Intl.NumberFormat('fa-IR').format(tiles.lowStock)} کالا به حداقل موجودی رسیده است.`,
        color: 'orange',
      });
    }
    if (tiles.oversold > 0) {
      notifications.show({
        title: 'خالی‌فروشی',
        message: `${new Intl.NumberFormat('fa-IR').format(tiles.oversold)} کالا در وضعیت خالی‌فروشی است.`,
        color: 'red',
      });
    }
    // یک بار در ورود به داشبورد کافی است.
  }, []);

  const boxes = [
    {
      label: 'نقطه سفارش',
      value: tiles.reorder,
      icon: IconListDetails,
      href: '/products/reorder-list',
      color: 'blue',
    },
    {
      label: 'رو به اتمام',
      value: tiles.lowStock,
      icon: IconAlertTriangle,
      href: '/products/low-stock',
      color: 'orange',
    },
    {
      label: 'خالی‌فروشی',
      value: tiles.oversold,
      icon: IconPackages,
      href: '/products/oversell',
      color: 'red',
    },
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }}>
      {boxes.map((box) => (
        <UnstyledButton key={box.label} component={Link} href={box.href}>
          <Card padding="lg" withBorder style={{ transition: 'border-color 120ms ease' }}>
            <Group justify="space-between" wrap="nowrap">
              <Stack gap={0}>
                <Text size="sm" c="dimmed">
                  {box.label}
                </Text>
                <Text size="h2" fw={800} c={box.value > 0 ? box.color : undefined}>
                  {new Intl.NumberFormat('fa-IR').format(box.value)}
                </Text>
              </Stack>
              <box.icon size={26} stroke={1.6} style={{ opacity: 0.5 }} />
            </Group>
          </Card>
        </UnstyledButton>
      ))}
    </SimpleGrid>
  );
}
