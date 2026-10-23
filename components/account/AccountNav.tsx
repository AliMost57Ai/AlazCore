'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconArrowBackUp,
  IconHeart,
  IconKey,
  IconMessage,
  IconPackage,
  IconUserCircle,
  IconWallet,
} from '@tabler/icons-react';
import { Box, NavLink } from '@mantine/core';

const ITEMS = [
  { href: '/account', label: 'مشخصات', icon: IconUserCircle, exact: true },
  { href: '/account/orders', label: 'سفارش‌های من', icon: IconPackage, exact: false },
  { href: '/account/favorites', label: 'علاقه‌مندی‌ها', icon: IconHeart, exact: false },
  { href: '/account/returns', label: 'مرجوعی‌های من', icon: IconArrowBackUp, exact: false },
  { href: '/account/wallet', label: 'کیف پول', icon: IconWallet, exact: false },
  { href: '/account/support', label: 'پشتیبانی فروشگاه', icon: IconMessage, exact: false },
  { href: '/account/password', label: 'تغییر گذرواژه', icon: IconKey, exact: false },
] as const;

/**
 * The account-area sub-navigation — each entry is its own page (profile,
 * orders, password). The active link is derived from the pathname, so the
 * server layout stays free of client hooks.
 */
export default function AccountNav() {
  const pathname = usePathname();

  return (
    <Box>
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <NavLink
            key={href}
            component={Link}
            href={href}
            active={active}
            label={label}
            leftSection={<Icon size={18} />}
            variant="light"
            style={{ borderRadius: 'var(--mantine-radius-md)' }}
          />
        );
      })}
    </Box>
  );
}
