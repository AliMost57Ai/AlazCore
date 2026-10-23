'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IconChevronDown,
  IconLifebuoy,
  IconLogout,
  IconSettings,
  IconUserCircle,
} from '@tabler/icons-react';
import { Avatar, Box, Menu, Text, UnstyledButton } from '@mantine/core';
import classes from './UserMenu.module.css';

export interface UserMenuProps {
  name: string;
  email: string;
  role: 'admin' | 'member';
}

const ROLE_LABELS: Record<UserMenuProps['role'], string> = {
  admin: 'مدیر سیستم',
  member: 'کاربر',
};

/** Two-letter initials from a Persian or Latin full name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2);
  }
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`;
}

export default function UserMenu({ name, email, role }: UserMenuProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      // Navigate regardless: middleware will bounce us to /login if the cookie
      // somehow survived, so the user is never stranded on a dead page.
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <Menu width={230} position="bottom-end" withArrow shadow="md">
      <Menu.Target>
        <UnstyledButton className={classes.trigger} aria-label="منوی کاربر">
          <Avatar color="brand" radius="xl" size={34}>
            {initials(name)}
          </Avatar>
          <Box className={classes.identity} visibleFrom="sm">
            <Text size="sm" fw={600} lh={1.2} truncate>
              {name}
            </Text>
            <Text size="xs" c="dimmed" lh={1.2}>
              {ROLE_LABELS[role]}
            </Text>
          </Box>
          <IconChevronDown size={16} className={classes.chevron} />
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          <Text size="xs" c="dimmed" dir="ltr" ta="start" truncate>
            {email}
          </Text>
        </Menu.Label>

        <Menu.Item component={Link} href="/settings" leftSection={<IconUserCircle size={16} />}>
          حساب کاربری
        </Menu.Item>
        <Menu.Item component={Link} href="/settings" leftSection={<IconSettings size={16} />}>
          تنظیمات
        </Menu.Item>
        {/* ارتباط با پشتیبانی آلازکور — طبق نیاز، داخل منوی پروفایل است نه سایدبار. */}
        <Menu.Item component={Link} href="/support" leftSection={<IconLifebuoy size={16} />}>
          ارتباط با پشتیبانی
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item
          color="red"
          leftSection={<IconLogout size={16} />}
          disabled={signingOut}
          onClick={handleSignOut}
        >
          {signingOut ? 'در حال خروج…' : ''}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
