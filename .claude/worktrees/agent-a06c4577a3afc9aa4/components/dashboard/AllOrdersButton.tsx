'use client';

import Link from 'next/link';
import { IconArrowRight } from '@tabler/icons-react';
import { Button } from '@mantine/core';

/**
 * Client component on purpose: it renders `<IconArrowRight>` inside a client
 * `<Button>`'s `rightSection` — a component reference that cannot cross the
 * server/client boundary from a server page.
 */
export default function AllOrdersButton() {
  return (
    <Button
      component={Link}
      href="/orders"
      variant="subtle"
      size="compact-sm"
      // mantine-rotate-rtl flips it 180° under dir="rtl", so the arrow points
      // "forward" in both directions.
      rightSection={<IconArrowRight size={15} className="mantine-rotate-rtl" />}
    >
      همه سفارش‌ها
    </Button>
  );
}
