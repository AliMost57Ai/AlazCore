'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { IconBolt, IconSearch } from '@tabler/icons-react';
import {
  ActionIcon,
  AppShell,
  Burger,
  Divider,
  Group,
  ScrollArea,
  Text,
  TextInput,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';
import { notifications as toast } from '@mantine/notifications';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import BellMenu, { type BellNotifications } from './BellMenu';
import DirectionControl, { ColorSchemeControl } from './HeaderControls';
import NavLinks from './NavLinks';
import UserMenu, { type UserMenuProps } from './UserMenu';
import classes from './DashboardShell.module.css';

export interface DashboardShellProps {
  user: UserMenuProps;
  /** Signed-in menu permissions ('*' = everything); omitted shows all. */
  perms?: string[];
  /** Live per-href badge counts (site DB — computed in the layout). */
  badges?: Record<string, number>;
  /** Live bell counts (site DB — computed in the layout). */
  notifications?: BellNotifications;
  /** hrefهایی که فیچر خاموش Core باید همیشه از منو حذف بماند. */
  disabledHrefs?: string[];
  children: ReactNode;
}

export default function DashboardShell({
  user,
  perms,
  badges,
  notifications,
  disabledHrefs,
  children,
}: DashboardShellProps) {
  const theme = useMantineTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const isDesktop = useMediaQuery(`(min-width: ${theme.breakpoints.sm})`, false, {
    getInitialValueInEffect: false,
  });

  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);

  // شمارهای زنده — props سروری پایه‌اند و watcher با polling تازه‌شان می‌کند.
  const [liveBadges, setLiveBadges] = useState<Record<string, number>>(badges ?? {});
  const [liveNotifications, setLiveNotifications] = useState<BellNotifications>(
    notifications ?? { support: 0, oversell: 0, reorder: 0, lowStock: 0 }
  );
  const prevSupportRef = useRef(liveNotifications.support);

  // پس از هر ناوبری سروری، props تازه state را بازهم‌گام می‌کند (polling بین
  // ناوبری‌هاست که شکاف را پر می‌کند).
  useEffect(() => {
    if (badges) {
      setLiveBadges(badges);
    }
  }, [badges]);
  useEffect(() => {
    if (notifications) {
      setLiveNotifications(notifications);
      prevSupportRef.current = notifications.support;
    }
  }, [notifications]);

  // زنگ زندهٔ تیکت جدید — polling سبک ۳۰ ثانیه‌ای visibility-gated روی
  // /api/notifications؛ افزایش شمار پشتیبانی = اعلان toast و به‌روز شدن بج/زنگ
  // بدون رفرش صفحه (الگوی polling ریپو — بدون SSE/websocket).
  useEffect(() => {
    let cancelled = false;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void (async () => {
        try {
          const response = await fetch('/api/notifications', { cache: 'no-store' });
          if (!response.ok) {
            return;
          }
          const data = (await response.json()) as {
            badges?: Record<string, number>;
            notifications?: BellNotifications;
            latest?: { displayId: string; requesterName: string; subject: string } | null;
          };
          if (cancelled || !data.notifications) {
            return;
          }
          const next = data.notifications;
          if (next.support > prevSupportRef.current) {
            toast.show({
              title: 'تیکت جدید پشتیبانی',
              message: data.latest
                ? `${data.latest.requesterName} — ${data.latest.displayId}: ${data.latest.subject}`
                : 'یک تیکت جدید در انتظار پاسخ شماست.',
              color: 'brand',
            });
          }
          prevSupportRef.current = next.support;
          setLiveNotifications(next);
          if (data.badges) {
            setLiveBadges(data.badges);
          }
        } catch {
          // خطای شبکه — تلاش بعدی در تیک بعدی.
        }
      })();
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  /** جستجوی سراسری هدر — Enter کاربر را با همان عبارت به فیلتر سفارش‌ها
   *  می‌فرستد (شناسه، نام مشتری یا موبایل). کنترل بی‌عملکرد در پنل ممنوع. */
  function submitSearch() {
    const term = query.trim();
    if (term) {
      router.push(`/orders?q=${encodeURIComponent(term)}`);
    }
  }

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
              placeholder="جستجو در سفارش‌ها…"
              size="sm"
              radius="md"
              leftSection={<IconSearch size={16} />}
              visibleFrom="md"
              w={220}
              aria-label="جستجو در سفارش‌ها"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  submitSearch();
                }
              }}
            />
            <Tooltip label="جستجو در سفارش‌ها">
              <ActionIcon
                variant="default"
                size="lg"
                radius="md"
                hiddenFrom="md"
                aria-label="جستجو در سفارش‌ها"
                onClick={submitSearch}
              >
                <IconSearch size={19} />
              </ActionIcon>
            </Tooltip>

            <BellMenu notifications={liveNotifications} />

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
          <NavLinks
            onNavigate={isDesktop ? undefined : closeMobile}
            perms={perms}
            badges={liveBadges}
            disabledHrefs={disabledHrefs}
          />
        </AppShell.Section>

        <AppShell.Section className={classes.navFooter}>
          <Group gap={6} wrap="nowrap">
            <span className={classes.footerMark} aria-hidden="true">
              <IconBolt size={11} stroke={2.4} />
            </span>
            <Text size="xs" c="dimmed">
              AlazCore · نسخه ۱٫۰٫۰
            </Text>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
