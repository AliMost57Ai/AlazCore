'use client';

import type { ReactNode } from 'react';
import {
  Card,
  Group,
  SegmentedControl,
  Stack,
  Text,
  useDirection,
  useMantineColorScheme,
} from '@mantine/core';
import { DIRECTION_COOKIE, SESSION_MAX_AGE, type Direction } from '@/lib/constants';

function persistDirection(dir: Direction) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${DIRECTION_COOKIE}=${dir}; Path=/; Max-Age=${SESSION_MAX_AGE}; SameSite=Lax${secure}`;
}

interface RowProps {
  label: string;
  description: string;
  children: ReactNode;
}

function Row({ label, description, children }: RowProps) {
  return (
    <Group justify="space-between" wrap="wrap" gap="sm">
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Text size="sm" fw={500}>
          {label}
        </Text>
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      </Stack>
      {children}
    </Group>
  );
}

export default function AppearanceSettings() {
  const { dir, setDirection } = useDirection();
  // Not `useComputedColorScheme`: this control has to be able to show "auto",
  // which the computed value resolves away.
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <Card>
      <Text fw={600} mb="lg">
        نمایش و چیدمان
      </Text>

      <Stack gap="lg">
        <Row label="جهت چیدمان" description="راست‌به‌چپ برای فارسی، چپ‌به‌راست برای انگلیسی.">
          <SegmentedControl
            value={dir}
            onChange={(value) => {
              const next = value as Direction;
              setDirection(next);
              persistDirection(next);
            }}
            data={[
              { value: 'rtl', label: 'راست‌به‌چپ' },
              { value: 'ltr', label: 'چپ‌به‌راست' },
            ]}
            size="sm"
          />
        </Row>

        <Row label="پوسته" description="«سیستم» از تنظیمات دستگاه شما پیروی می‌کند.">
          <SegmentedControl
            value={colorScheme}
            onChange={(value) => setColorScheme(value as 'light' | 'dark' | 'auto')}
            data={[
              { value: 'light', label: 'روشن' },
              { value: 'dark', label: 'تاریک' },
              { value: 'auto', label: 'سیستم' },
            ]}
            size="sm"
          />
        </Row>
      </Stack>
    </Card>
  );
}
