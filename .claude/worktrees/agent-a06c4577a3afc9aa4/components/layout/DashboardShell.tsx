'use client';

import type { ReactNode } from 'react';
import { IconBell, IconBolt, IconSearch } from '@tabler/icons-react';
import {
  ActionIcon,
  AppShell,
  Burger,
  Divider,
  Group,
  Indicator,
  ScrollArea,
  Text,
  TextInput,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import type { SupportTicketStats } from '@/lib/support';
import DirectionControl, { ColorSchemeControl } from './HeaderControls';
import NavLinks from './NavLinks';
import NotificationsMenu from './NotificationsMenu';
import UserMenu, { type UserMenuProps } from './UserMenu';
import classes from './DashboardShell.module.css';

export interface DashboardShellProps {
  user: UserMenuProps;
  /** Signed-in menu permissions ('*' = everything); omitted shows all. */
  perms?: string[];
  /**
   * Support-ticket counters for the notification bell — null for staff whose
   * role holds no /support grant, who then get the plain, menu-less bell.
   */
  supportStats?: SupportTicketStats | null;
  children: ReactNode;
}

export default function DashboardShell({
  user,
  perms,
  supportStats = null,
  children,
}: DashboardShellProps) {
  const theme = useMantineTheme();
  const isDesktop = useMediaQuery(`(min-width: ${theme.breakpoints.sm})`, false, {
    getInitialValueInEffect: false,
  });

  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 272,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding={{ base: 'sm', sm: 'lg' }}
    >
      <AppShell.Header className={classes.header}>
        <Group
          h="100%"
          px={{ base: 'sm', sm: 'md' }}
          justify="space-between"
          wrap="nowrap"
          gap="xs"
        >
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
            {/* One burger drives the mobile drawer, the other collapses the
                desktop navbar — AppShell tracks the two states separately. */}
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
              aria-label="نمایش یا پنهان‌کردن منو"
            />
            <Burger
              opened={desktopOpened}
              onClick={toggleDesktop}
              visibleFrom="sm"
              size="sm"
              aria-label="جمع‌کردن منوی کناری"
            />

            <Group gap={8} wrap="nowrap" className={classes.brand}>
              <span className={classes.brandMark} aria-hidden="true">
                <IconBolt size={17} stroke={2.2} />
              </span>
              <Text fw={700} size="md" className={classes.brandText}>
                پنل مدیریت
              </Text>
            </Group>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <TextInput
              placeholder="جستجو…"
              size="sm"
              radius="md"
              leftSection={<IconSearch size={16} />}
              visibleFrom="md"
              w={220}
              aria-label="جستجو"
            />
            <Tooltip label="جستجو">
              <ActionIcon
                variant="default"
                size="lg"
                radius="md"
                hiddenFrom="md"
                aria-label="جستجو"
              >
                <IconSearch size={19} />
              </ActionIcon>
            </Tooltip>

            {supportStats ? (
              <NotificationsMenu initial={supportStats} />
            ) : (
              <Indicator size={7} offset={6} color="red" withBorder>
                <Tooltip label="اعلان‌ها">
                  <ActionIcon variant="default" size="lg" radius="md" aria-label="اعلان‌ها">
                    <IconBell size={19} />
                  </ActionIcon>
                </Tooltip>
              </Indicator>
            )}

            <DirectionControl />
            <ColorSchemeControl />

            <Divider orientation="vertical" visibleFrom="sm" />

            <UserMenu {...user} />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow component={ScrollArea} type="scroll">
          {/* Only close on navigate when the navbar is an overlay drawer. */}
          <NavLinks onNavigate={isDesktop ? undefined : closeMobile} perms={perms} />
        </AppShell.Section>

        <AppShell.Section className={classes.navFooter}>
          <Text size="xs" c="dimmed">
            AlazCore - online Shop Generatore
          </Text>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
