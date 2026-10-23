'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AppShell,
  Badge,
  Burger,
  Button,
  Code,
  Group,
  Image,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Title,
  UnstyledButton,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { notifications as toast } from '@mantine/notifications';
import {
  IconChartBar,
  IconChevronLeft,
  IconCreditCard,
  IconDeviceAnalytics,
  IconIdBadge2,
  IconLayoutDashboard,
  IconLogout,
  IconMessage,
  IconMoonStars,
  IconSettings,
  IconShieldHalf,
  IconShieldLock,
  IconSunHigh,
  IconTemplate,
  IconTicket,
  IconUsersGroup,
  IconWorldWww,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

export interface PanelUser {
  name: string;
  email: string;
  role: string;
}

interface PanelShellProps {
  user: PanelUser;
  /** منوهای مجاز نقش ('*' = همه) — مثل NavLinks فروشگاه فیلتر می‌کند. */
  perms?: string[];
  /** بج شمارش روی آیتم‌های منو (مثلاً تیکت‌های در انتظار پشتیبان). */
  badges?: Record<string, number>;
  children: ReactNode;
}

/** آیتم ساده یا گروه با زیرمنو — هم‌سان NavLinks فروشگاه. */
type NavEntry =
  | { href: string; label: string; icon: typeof IconLayoutDashboard }
  | {
      id: string;
      label: string;
      icon: typeof IconLayoutDashboard;
      children: { href: string; label: string; icon: typeof IconLayoutDashboard }[];
    };

function isGroup(entry: NavEntry): entry is Extract<NavEntry, { children: unknown[] }> {
  return 'children' in entry;
}

const NAV: NavEntry[] = [
  { href: '/panel', label: 'داشبورد', icon: IconLayoutDashboard },
  {
    id: 'tenants',
    label: 'فروشگاه‌ها',
    icon: IconWorldWww,
    children: [
      { href: '/panel/domains', label: 'مدیریت دامین‌ها', icon: IconWorldWww },
      { href: '/panel/plans', label: 'مدیریت پلن‌ها', icon: IconShieldHalf },
      { href: '/panel/templates', label: 'مدیریت تم‌ها', icon: IconTemplate },
    ],
  },
  {
    id: 'pay-sms',
    label: 'درگاه و پیامک',
    icon: IconCreditCard,
    children: [
      { href: '/panel/gateways', label: 'مدیریت درگاه‌ها', icon: IconCreditCard },
      { href: '/panel/bnpl', label: 'مدیریت درگاه‌های اقساطی', icon: IconCreditCard },
      { href: '/panel/sms-panels', label: 'مدیریت پنل پیامکی', icon: IconMessage },
    ],
  },
  {
    id: 'reports',
    label: 'گزارشات',
    icon: IconChartBar,
    children: [
      { href: '/panel/reports/products', label: 'محصولات هر سایت', icon: IconChartBar },
      { href: '/panel/reports/product-sales', label: 'فروش هر کالا', icon: IconChartBar },
      { href: '/panel/reports/monthly-sales', label: 'فروش ماهانه سایت‌ها', icon: IconChartBar },
      { href: '/panel/reports/revenue', label: 'درآمد آلازکور', icon: IconChartBar },
    ],
  },
  { href: '/panel/tickets', label: 'تیکت‌های پشتیبانی', icon: IconTicket },
  {
    id: 'users-group',
    label: 'مدیریت کاربران',
    icon: IconIdBadge2,
    children: [
      { href: '/panel/users', label: 'کاربران Core', icon: IconIdBadge2 },
      { href: '/panel/roles', label: 'نقش‌ها', icon: IconShieldLock },
    ],
  },
  { href: '/panel/settings', label: 'تنظیمات سامانه', icon: IconSettings },
];

/** فیلتر منو بر اساس perms — هم‌سان entryVisible فروشگاه. */
function isVisible(href: string, perms?: string[]): boolean {
  if (!perms || perms.includes('*')) {
    return true;
  }
  if (href === '/panel') {
    return true;
  }
  return perms.includes(href) || perms.some((entry) => entry.startsWith(`${href}:`));
}

function groupVisible(entry: Extract<NavEntry, { children: unknown[] }>, perms?: string[]): boolean {
  return entry.children.some((child) => isVisible(child.href, perms));
}

function isActive(pathname: string, href: string): boolean {
  return href === '/panel' ? pathname === '/panel' : pathname.startsWith(href);
}

export default function PanelShell({ user, perms, badges, children }: PanelShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useMantineTheme();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const isSuperadmin = user.role === 'superadmin';

  // بج‌های زنده — props سروری پایه‌اند و watcher با polling تازه‌شان می‌کند.
  const [liveBadges, setLiveBadges] = useState<Record<string, number>>(badges ?? {});
  const prevCountRef = useRef(liveBadges['/panel/tickets'] ?? 0);

  // پس از هر ناوبری سروری، props تازه state را بازهم‌گام می‌کند.
  useEffect(() => {
    if (badges) {
      setLiveBadges(badges);
      prevCountRef.current = badges['/panel/tickets'] ?? 0;
    }
  }, [badges]);

  // زنگ زندهٔ تیکت جدید — polling سبک ۳۰ ثانیه‌ای visibility-gated روی
  // /api/tickets/unread-count؛ افزایش شمار = اعلان toast و به‌روز شدن بج منو
  // بدون رفرش (الگوی polling ریپو — بدون SSE/websocket).
  useEffect(() => {
    let cancelled = false;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void (async () => {
        try {
          const response = await fetch('/api/tickets/unread-count', { cache: 'no-store' });
          if (!response.ok) {
            return;
          }
          const data = (await response.json()) as {
            count?: number;
            latest?: { displayId: string; requesterName: string; subject: string } | null;
          };
          if (cancelled || typeof data.count !== 'number') {
            return;
          }
          if (data.count > prevCountRef.current) {
            toast.show({
              title: 'تیکت جدید پشتیبانی',
              message: data.latest
                ? `${data.latest.requesterName} — ${data.latest.displayId}: ${data.latest.subject}`
                : 'یک تیکت جدید از مالکان فروشگاه‌ها در انتظار پاسخ شماست.',
              color: 'brand',
            });
          }
          prevCountRef.current = data.count;
          setLiveBadges((current) => ({ ...current, '/panel/tickets': data.count as number }));
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

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 264,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding={{ base: 'sm', sm: 'lg' }}
    >
      <AppShell.Header
        style={{
          background: 'var(--mantine-color-body)',
          borderBottom: '1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))',
        }}
      >
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
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
              aria-label="باز یا بسته‌کردن سایدبار"
            />
            <UnstyledButton component={Link} href="/panel">
              <Group gap="sm" wrap="nowrap">
                {/* لوگوی رسمی AlazCore — پس‌زمینه تیره از خود لوگو می‌آید */}
                <Image
                  src="/logo.png"
                  alt="AlazCore"
                  w={38}
                  h={38}
                  radius="md"
                  fit="contain"
                  style={{ background: '#fff', padding: 3, border: '1px solid var(--mantine-color-gray-3)' }}
                />
                <Stack gap={0} visibleFrom="sm">
                  <Title order={4} lh={1.1}>
                    AlazCore
                  </Title>
                  <Text size="xs" c="dimmed" lh={1.2}>
                    پنل ارتباط با مشتریان
                  </Text>
                </Stack>
              </Group>
            </UnstyledButton>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <Button
              variant="subtle"
              color="white"
              onClick={() => toggleColorScheme()}
              aria-label="تغییر تم روشن/تیره"
              px={8}
            >
              {colorScheme === 'dark' ? <IconSunHigh size={18} /> : <IconMoonStars size={18} />}
            </Button>
            <Menu shadow="md" width={220} position="bottom-end">
              <Menu.Target>
                <UnstyledButton px="sm" py={6} style={{ borderRadius: theme.radius.md }}>
                  <Group gap="sm" wrap="nowrap">
                    <Stack gap={0} align="end">
                      <Text size="sm" fw={600} lh={1.2}>
                        {user.name}
                      </Text>
                      <Text size="xs" c="dimmed" lh={1.2}>
                        {isSuperadmin ? 'مدیر کل' : 'پشتیبان'}
                      </Text>
                    </Stack>
                    <Badge color="brand" variant="light" size="lg" radius="md">
                      {user.name.slice(0, 1)}
                    </Badge>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user.email}</Menu.Label>
                <Menu.Item
                  leftSection={<IconDeviceAnalytics size={16} />}
                  component={Link}
                  href="/panel/settings"
                >
                  تنظیمات سامانه
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="crimson" leftSection={<IconLogout size={16} />} onClick={logout}>
                  خروج از حساب
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" style={{ borderColor: 'light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))' }}>
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={4}>
            {NAV.filter((item) =>
              isGroup(item) ? groupVisible(item, perms) : isVisible(item.href, perms)
            ).map((item) => {
              const Icon = item.icon;
              if (!isGroup(item)) {
                const badge = liveBadges?.[item.href];
                return (
                  <NavLink
                    key={item.href}
                    component={Link}
                    href={item.href}
                    label={item.label}
                    leftSection={<Icon size={18} stroke={1.6} />}
                    rightSection={
                      badge ? (
                        <Badge size="xs" variant="filled" color="red" circle>
                          {badge > 9 ? '۹+' : String(badge)}
                        </Badge>
                      ) : null
                    }
                    active={isActive(pathname, item.href)}
                    onClick={closeMobile}
                    variant="light"
                    color="brand"
                  />
                );
              }
              const anyChildActive = item.children.some((child) => isActive(pathname, child.href));
              return (
                <NavLink
                  key={item.id}
                  label={item.label}
                  leftSection={<Icon size={18} stroke={1.6} />}
                  variant="light"
                  color="brand"
                  defaultOpened={anyChildActive}
                  onClick={closeMobile}
                >
                  {/* زیرمنو — فرزندان با تورفتگی */}
                  <Stack gap={2} mt={4}>
                    {item.children
                      .filter((child) => isVisible(child.href, perms))
                      .map((child) => {
                        const ChildIcon = child.icon;
                        return (
                          <NavLink
                            key={child.href}
                            component={Link}
                            href={child.href}
                            label={child.label}
                            leftSection={<ChildIcon size={15} stroke={1.6} />}
                            active={isActive(pathname, child.href)}
                            onClick={closeMobile}
                            variant="subtle"
                            color="brand"
                            style={{ paddingRight: 26 }}
                          />
                        );
                      })}
                  </Stack>
                </NavLink>
              );
            })}
          </Stack>
        </AppShell.Section>
        <AppShell.Section>
          <Code
            block
            style={{
              background: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))',
              color: 'light-dark(var(--mantine-color-dark-6), var(--mantine-color-dark-1))',
              border: '1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4))',
              fontSize: 12,
            }}
          >
            {isSuperadmin ? 'دسترسی: مدیر کل' : 'دسترسی: پشتیبانی'} — v1.0
          </Code>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))">{children}</AppShell.Main>
    </AppShell>
  );
}
