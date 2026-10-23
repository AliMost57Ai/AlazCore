'use client';

import Link from 'next/link';
import {
  IconAlertTriangle,
  IconBell,
  IconListDetails,
  IconMapPin,
  IconPackages,
  IconTicket,
} from '@tabler/icons-react';
import {
  ActionIcon,
  Indicator,
  Popover,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { enNumber } from '@/lib/format';
import type { BellNotifications } from '@/lib/bell';

// شکل داده در lib/bell تعریف شده (تک منبع layout سروری + API زنده) — فقط
// type re-export تا importهای قدیمی از BellMenu نشکنند.
export type { BellNotifications } from '@/lib/bell';

const ROWS: {
  key: keyof BellNotifications;
  label: string;
  href: string;
  icon: typeof IconBell;
  color: string;
}[] = [
  {
    key: 'support',
    label: 'پشتیبانی باز و خوانده‌نشده',
    href: '/customer-support',
    icon: IconTicket,
    color: 'var(--mantine-color-blue-7)',
  },
  {
    key: 'oversell',
    label: 'خالی‌فروشی',
    href: '/products/oversell',
    icon: IconPackages,
    color: 'var(--mantine-color-red-7)',
  },
  {
    key: 'reorder',
    label: 'لیست خرید (نقطه سفارش)',
    href: '/products/reorder-list',
    icon: IconListDetails,
    color: 'var(--mantine-color-brand-filled)',
  },
  {
    key: 'lowStock',
    label: 'رو به اتمام',
    href: '/products/low-stock',
    icon: IconAlertTriangle,
    color: 'var(--mantine-color-orange-7)',
  },
];

/**
 * ردیف‌های تحویل حضوری — فقط وقتی فیچر در Core فعال باشد layout این کلیدها
 * را می‌فرستد؛ نبودِ کلید = پنهان.
 */
const PICKUP_ROWS: {
  key: keyof PickUpKeys;
  label: string;
  href: string;
  icon: typeof IconBell;
  color: string;
}[] = [
  {
    key: 'pickupReserved',
    label: 'رزروهای تحویل حضوری',
    href: '/orders/pickup',
    icon: IconMapPin,
    color: 'var(--mantine-color-violet-7)',
  },
  {
    key: 'pickupDelivered',
    label: 'تحویل‌شده‌های حضوری',
    href: '/orders/pickup?filter=delivered',
    icon: IconMapPin,
    color: 'var(--mantine-color-teal-7)',
  },
];

type PickUpKeys = {
  pickupReserved: number;
  pickupDelivered: number;
};

/**
 * زنگ اعلان‌های هدر داشبورد — شمار واقعی از دیتابیس سایت (layout سروری
 * محاسبه می‌کند): پشتیبانی باز، خالی‌فروشی، لیست خرید، رو به اتمام و
 * تحویل حضوری (رزرو/تحویل‌شده — فقط وقتی فیچر فعال است).
 */
export default function BellMenu({ notifications }: { notifications: BellNotifications }) {
  const pickupRows = PICKUP_ROWS.filter((row) => notifications[row.key] !== undefined);
  const rows = [...ROWS, ...pickupRows];
  const total = rows.reduce((sum, row) => sum + (notifications[row.key] ?? 0), 0);

  return (
    <Popover width={280} position="bottom-end" withArrow shadow="md">
      <Popover.Target>
        {total > 0 ? (
          <Indicator size={16} offset={6} color="red" withBorder label={enNumber(total)}>
            <Tooltip label="اعلان‌ها">
              <ActionIcon variant="default" size="lg" radius="md" aria-label="اعلان‌ها">
                <IconBell size={19} />
              </ActionIcon>
            </Tooltip>
          </Indicator>
        ) : (
          <Tooltip label="اعلان‌ها">
            <ActionIcon variant="default" size="lg" radius="md" aria-label="اعلان‌ها">
              <IconBell size={19} />
            </ActionIcon>
          </Tooltip>
        )}
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap={2}>
          {rows.map((row) => {
            const count = notifications[row.key] ?? 0;
            return (
              <UnstyledButton
                key={row.key}
                component={Link}
                href={row.href}
                onClick={() => undefined}
                px="xs"
                py={6}
                style={{ borderRadius: 8 }}
              >
                <row.icon size={16} stroke={1.8} style={{ color: row.color }} />
                <Text component="span" size="sm" mx={6}>
                  {row.label}
                </Text>
                <Text component="span" size="sm" fw={800} c={count > 0 ? row.color : 'dimmed'}>
                  {enNumber(count)}
                </Text>
              </UnstyledButton>
            );
          })}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
