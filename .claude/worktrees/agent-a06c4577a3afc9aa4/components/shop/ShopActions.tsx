'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IconChevronDown,
  IconHeadset,
  IconKey,
  IconLogout,
  IconPackage,
  IconShoppingCart,
  IconUser,
  IconUserCircle,
  IconWallet,
} from '@tabler/icons-react';
import { ActionIcon, Anchor, Button, Group, Indicator, Menu, Text } from '@mantine/core';
import { faCompact } from '@/lib/format';
import AuthModal, { type AuthModalMode } from './AuthModal';
import CartDrawer from './CartDrawer';
import { useShopCart } from './ShopCartProvider';

export interface ShopSession {
  name: string;
  role: 'admin' | 'member' | 'customer';
  /** Wallet balance in Toman — shown on the customer's header chip. */
  walletBalance: number;
}

/**
 * The storefront header's interactive cluster: cart button (with live badge
 * and drawer), the customer's wallet chip + account menu, or the
 * login/signup entry points when signed out. Extracted from ShopHeader so
 * every theme header (components/themes/*) can embed the same behaviour
 * inside its own chrome.
 */
export default function ShopActions({
  session,
  requireNationalId = false,
}: {
  session: ShopSession | null;
  /** True when Shahkar matching is on — the signup step asks for کد ملی. */
  requireNationalId?: boolean;
}) {
  const router = useRouter();
  const { count, pendingCount, refreshPending } = useShopCart();
  const [authOpened, setAuthOpened] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>('login');
  const [cartOpened, setCartOpened] = useState(false);

  const isCustomer = session?.role === 'customer';
  // The basket badge covers the whole basket: local lines + the unpaid order.
  const badgeCount = count + pendingCount;

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    // The unpaid order belongs to the signed-in account — drop it from the badge.
    refreshPending();
    router.refresh();
  }

  return (
    <>
      <Group gap="sm" wrap="nowrap">
        <Indicator
          color="red"
          size={18}
          label={badgeCount > 0 ? String(badgeCount) : null}
          disabled={badgeCount === 0}
        >
          <ActionIcon
            variant="light"
            size="lg"
            aria-label="سبد خرید"
            onClick={() => setCartOpened(true)}
          >
            <IconShoppingCart size={20} />
          </ActionIcon>
        </Indicator>

        {session ? (
          isCustomer ? (
            <>
              {/* The customer's wallet balance, one click from the wallet page. */}
              <Anchor
                href="/account/wallet"
                aria-label="کیف پول"
                underline="never"
                size="sm"
                fw={700}
                c="brand"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 'var(--mantine-radius-xl)',
                  background: 'var(--mantine-color-brand-light)',
                }}
              >
                <IconWallet size={16} />
                {faCompact(session.walletBalance)} تومان
              </Anchor>

              <Menu width={230} position="bottom-end" withArrow shadow="md">
                <Menu.Target>
                  <Group
                    gap={6}
                    wrap="nowrap"
                    style={{ cursor: 'pointer' }}
                    aria-label="منوی حساب کاربری"
                  >
                    <IconUser size={18} />
                    <Text size="sm" fw={600} visibleFrom="xs" truncate maw={140}>
                      {session.name}
                    </Text>
                    <IconChevronDown size={14} />
                  </Group>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Item
                    component={Link}
                    href="/account"
                    leftSection={<IconUserCircle size={16} />}
                  >
                    حساب کاربری
                  </Menu.Item>
                  <Menu.Item
                    component={Link}
                    href="/account/orders"
                    leftSection={<IconPackage size={16} />}
                  >
                    سفارش‌های من
                  </Menu.Item>
                  <Menu.Item
                    component={Link}
                    href="/account/wallet"
                    leftSection={<IconWallet size={16} />}
                    rightSection={
                      <Text size="xs" c="dimmed">
                        {faCompact(session.walletBalance)} تومان
                      </Text>
                    }
                  >
                    کیف پول
                  </Menu.Item>
                  <Menu.Item
                    component={Link}
                    href="/account/support"
                    leftSection={<IconHeadset size={16} />}
                  >
                    پشتیبانی
                  </Menu.Item>
                  <Menu.Item
                    component={Link}
                    href="/account/password"
                    leftSection={<IconKey size={16} />}
                  >
                    تغییر گذرواژه
                  </Menu.Item>

                  <Menu.Divider />

                  <Menu.Item
                    color="red"
                    leftSection={<IconLogout size={16} />}
                    onClick={handleLogout}
                  >
                    خروج
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </>
          ) : (
            <Group gap="xs" wrap="nowrap">
              <Anchor href="/dashboard" size="sm" c="brand">
                پنل مدیریت
              </Anchor>
              {/* Staff signed into the panel still get the customer auth
                  entry points — the shop is a separate surface and the
                  modal never touches the staff session. */}
              <Button
                size="xs"
                variant="subtle"
                onClick={() => {
                  setAuthMode('login');
                  setAuthOpened(true);
                }}
              >
                ورود
              </Button>
              <Button
                size="xs"
                onClick={() => {
                  setAuthMode('signup');
                  setAuthOpened(true);
                }}
              >
                ثبت‌نام
              </Button>
            </Group>
          )
        ) : (
          <Group gap="xs" wrap="nowrap">
            <Button
              size="xs"
              variant="subtle"
              onClick={() => {
                setAuthMode('login');
                setAuthOpened(true);
              }}
            >
              ورود
            </Button>
            <Button
              size="xs"
              onClick={() => {
                setAuthMode('signup');
                setAuthOpened(true);
              }}
            >
              ثبت‌نام
            </Button>
          </Group>
        )}
      </Group>

      <AuthModal
        opened={authOpened}
        onClose={() => setAuthOpened(false)}
        mode={authMode}
        onModeChange={setAuthMode}
        requireNationalId={requireNationalId}
      />
      <CartDrawer
        opened={cartOpened}
        onClose={() => setCartOpened(false)}
        signedIn={Boolean(session)}
        onRequireAuth={() => {
          setAuthMode('login');
          setAuthOpened(true);
        }}
      />
    </>
  );
}
