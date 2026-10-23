'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconAlertCircle,
  IconCreditCard,
  IconMinus,
  IconPlus,
  IconShoppingCart,
  IconTrash,
} from '@tabler/icons-react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Divider,
  Drawer,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { faCurrency, faNumber } from '@/lib/format';
import type { OrderItem } from '@/lib/shop-orders';
import { useShopCart } from './ShopCartProvider';

/** The unpaid order shown in the basket — read-only until the customer pays it. */
interface PendingOrder {
  displayId: string;
  amount: number;
  items: OrderItem[];
}

/**
 * The cart drawer: line items with quantity steppers, total, and the checkout
 * entry point. Checking out requires a signed-in customer — when signed out,
 * the caller's auth modal opens instead of a request that would just 401.
 *
 * Until an order is paid it stays in the basket: the drawer fetches the
 * customer's pending order and shows its contents read-only, so a customer who
 * left mid-checkout can resume the payment steps straight from the basket.
 * The checkout button does not stop at "order saved": it registers the cart as
 * a (pending) order — merging into the existing unpaid one when there is one —
 * and takes the customer to the checkout page (address → delivery method →
 * online payment).
 */
export default function CartDrawer({
  opened,
  onClose,
  signedIn,
  onRequireAuth,
}: {
  opened: boolean;
  onClose: () => void;
  signedIn: boolean;
  onRequireAuth: () => void;
}) {
  const router = useRouter();
  const { items, count, total, setQty, remove, clear, refreshPending } = useShopCart();
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<PendingOrder | null>(null);

  // Re-fetches the unpaid order — called when the drawer opens and again after
  // a line is removed so the total and the item list stay in sync.
  const loadPending = useCallback(() => {
    fetch('/api/orders/pending')
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { order: PendingOrder | null };
        setPending(payload.order);
      })
      .catch(() => undefined);
  }, []);

  // While the drawer is open, keep the unpaid order in view — it is part of
  // the basket until it's paid.
  useEffect(() => {
    if (!opened || !signedIn) {
      setPending(null);
      return;
    }
    loadPending();
  }, [opened, signedIn, loadPending]);

  function goToCheckout(displayId: string) {
    onClose();
    router.push(`/checkout?order=${encodeURIComponent(displayId)}`);
  }

  /** Drops a line from the unpaid order — stock is restored server-side. */
  async function handleRemovePendingItem(
    productId: string,
    variantId: string | null,
    name: string
  ) {
    const query = new URLSearchParams({ productId });
    if (variantId) {
      query.set('variantId', variantId);
    }

    try {
      const response = await fetch(`/api/orders/pending?${query.toString()}`, {
        method: 'DELETE',
      });
      const payload = (await response.json().catch(() => ({}))) as {
        order?: PendingOrder | null;
        error?: string;
      };

      if (!response.ok) {
        notifications.show({
          title: 'حذف قلم ناموفق بود',
          message: payload.error ?? 'لطفاً دوباره تلاش کنید.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }

      setPending(payload.order ?? null);
      // The badge counts the unpaid order too — keep it in sync.
      refreshPending();
      notifications.show({
        title: 'از سفارش حذف شد',
        message: name,
        color: 'green',
        icon: <IconTrash size={18} />,
      });
      // Stock came back — re-render server-rendered product data.
      router.refresh();
    } catch {
      notifications.show({
        title: 'ارتباط برقرار نشد',
        message: 'اتصال خود را بررسی کنید و دوباره تلاش کنید.',
        color: 'red',
      });
    }
  }

  async function handleCheckout() {
    if (!signedIn) {
      onClose();
      onRequireAuth();
      return;
    }

    // Basket already holds the unpaid order and no new items were added.
    if (count === 0) {
      if (pending) {
        goToCheckout(pending.displayId);
      }
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            qty: line.qty,
          })),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        order?: { id: string; displayId: string; amount: number; merged?: boolean };
      };

      if (!response.ok || !payload.order) {
        notifications.show({
          title: 'ثبت سفارش ناموفق بود',
          message: payload.error ?? 'لطفاً دوباره تلاش کنید.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }

      const order = payload.order;
      clear();
      // The placed lines moved into the unpaid order — they stay in the badge.
      refreshPending();
      onClose();
      notifications.show({
        title: order.merged ? 'سبد به سفارش پرداخت‌نشده شما افزوده شد' : 'سفارش شما ثبت شد',
        message: `شماره سفارش: ${order.displayId} — ${faCurrency(order.amount, false)}.`,
        color: 'green',
        icon: <IconCreditCard size={18} />,
      });
      // Stock changed — re-render server-rendered product data.
      router.refresh();
      // Guide the customer through the payment steps right away.
      goToCheckout(order.displayId);
    } catch {
      notifications.show({
        title: 'ارتباط برقرار نشد',
        message: 'اتصال خود را بررسی کنید و دوباره تلاش کنید.',
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const emptyBasket = count === 0 && !pending;

  return (
    <Drawer opened={opened} onClose={onClose} title="سبد خرید" position="right" size="md">
      {emptyBasket ? (
        <Stack gap="sm" className="shop-cart-empty" mih={200} justify="center">
          <IconShoppingCart size={44} stroke={1.2} style={{ margin: '0 auto' }} />
          <Text size="sm" c="dimmed" ta="center">
            سبد خرید شما خالی است.
          </Text>
          <Anchor href="/" size="sm" c="brand" ta="center" onClick={onClose}>
            رفتن به فروشگاه
          </Anchor>
        </Stack>
      ) : (
        <Stack gap="md" mih="100%">
          {count > 0 ? (
            <Stack gap="md">
              {items.map((line) => (
                <Stack key={`${line.productId}-${line.variantId ?? 'base'}`} gap={4}>
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Text size="sm" fw={600} lineClamp={1}>
                      {line.name}
                      {line.variantName ? (
                        <Text component="span" size="sm" c="dimmed">
                          {' '}
                          — {line.variantName}
                        </Text>
                      ) : null}
                    </Text>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      aria-label={`حذف ${line.name}`}
                      onClick={() => remove(line.productId, line.variantId)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>

                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      <ActionIcon
                        variant="default"
                        size="sm"
                        aria-label="کاهش تعداد"
                        disabled={line.qty <= 1}
                        onClick={() => setQty(line.productId, line.variantId, line.qty - 1)}
                      >
                        <IconMinus size={14} />
                      </ActionIcon>
                      <Text size="sm" fw={600} style={{ minWidth: 24, textAlign: 'center' }}>
                        {faNumber(line.qty)}
                      </Text>
                      <ActionIcon
                        variant="default"
                        size="sm"
                        aria-label="افزایش تعداد"
                        disabled={line.qty >= line.maxStock}
                        onClick={() => setQty(line.productId, line.variantId, line.qty + 1)}
                      >
                        <IconPlus size={14} />
                      </ActionIcon>
                      <Text size="xs" c="dimmed">
                        × {faCurrency(line.unitPrice, false)}
                      </Text>
                    </Group>
                    <Text size="sm" fw={700}>
                      {faCurrency(line.unitPrice * line.qty, false)}
                    </Text>
                  </Group>
                </Stack>
              ))}
            </Stack>
          ) : null}

          {pending ? (
            <Stack gap="xs">
              <Divider
                labelPosition="center"
                label={
                  <Text size="xs" c="dimmed">
                    سفارش پرداخت‌نشده {pending.displayId}
                  </Text>
                }
              />
              <Text size="xs" c="dimmed">
                {count > 0
                  ? 'با ادامه خرید، اقلام بالا به این سفارش افزوده می‌شوند:'
                  : 'این سفارش تا پرداخت در سبد شما می‌ماند:'}
              </Text>
              {pending.items.map((item) => (
                <Group
                  key={`${item.productId}-${item.variantId ?? 'base'}-pending`}
                  justify="space-between"
                  gap="xs"
                  wrap="nowrap"
                >
                  <Text size="sm" c="dimmed" lineClamp={1}>
                    {item.name} × {faNumber(item.qty)}
                  </Text>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
                      {faCurrency(item.unitPrice * item.qty, false)}
                    </Text>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      aria-label={`حذف ${item.name} از سفارش`}
                      onClick={() =>
                        handleRemovePendingItem(item.productId, item.variantId, item.name)
                      }
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              ))}
              <Group justify="space-between">
                <Text size="sm" fw={600}>
                  جمع سفارش پرداخت‌نشده
                </Text>
                <Text size="sm" fw={800}>
                  {faCurrency(pending.amount, false)}
                </Text>
              </Group>
              <Button
                size="sm"
                variant="light"
                leftSection={<IconCreditCard size={16} />}
                onClick={() => goToCheckout(pending.displayId)}
              >
                پرداخت {pending.displayId}
              </Button>
            </Stack>
          ) : null}

          <Stack gap="sm" style={{ marginTop: 'auto' }}>
            <Divider />
            {count > 0 ? (
              <Group justify="space-between">
                <Text fw={600}>جمع کل اقلام جدید</Text>
                <Text fw={800}>{faCurrency(total, false)}</Text>
              </Group>
            ) : null}
            {!signedIn ? (
              <Alert variant="light" color="blue" icon={<IconAlertCircle size={16} />}>
                برای تکمیل خرید ابتدا وارد حساب خود شوید.
              </Alert>
            ) : (
              <Alert variant="light" color="blue" icon={<IconCreditCard size={16} />}>
                پس از ثبت، در چند مرحله آدرس تحویل را انتخاب و سفارش را آنلاین پرداخت می‌کنید.
              </Alert>
            )}
            <Button
              size="md"
              fullWidth
              loading={submitting}
              leftSection={<IconCreditCard size={18} />}
              onClick={handleCheckout}
            >
              {signedIn ? 'ادامه و پرداخت' : 'ورود و ادامه خرید'}
            </Button>
          </Stack>
        </Stack>
      )}
    </Drawer>
  );
}
