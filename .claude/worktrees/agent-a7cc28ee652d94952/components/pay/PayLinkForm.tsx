'use client';

import { useState } from 'react';
import { IconAlertCircle, IconCircleCheck, IconCreditCard, IconTruck } from '@tabler/icons-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Radio,
  RadioGroup,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { faCurrency, faNumber } from '@/lib/format';
import { STATUS_COLORS, STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import type { OrderItem } from '@/lib/shop-orders';

/** The invoice the shared link shows (plain data — no server imports). */
export interface PayLinkOrder {
  displayId: string;
  date: string;
  status: OrderStatus;
  items: OrderItem[];
  amount: number;
  discountAmount: number;
  couponCode: string | null;
  shippingCost: number;
  deliveryMethod: string | null;
}

/** One gateway option in the recipient's picker. */
export interface PayLinkGateway {
  id: string;
  label: string;
  kind: 'ipg' | 'bnpl';
}

export interface PayLinkFormProps {
  /** The share capability from the URL — also the pay endpoint's key. */
  token: string;
  order: PayLinkOrder;
  gateways: PayLinkGateway[];
  defaultGateway: string | null;
}

/** Posts hidden fields to a relay gateway's URL via a temporary form. */
function submitRelay(postUrl: string, postFields: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = postUrl;
  for (const [name, value] of Object.entries(postFields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

/**
 * The public pay page behind /pay/{token}: the invoice of the order the link
 * points at, and — while it's still unpaid — a gateway picker and a pay
 * button. View + pay only: nothing here can modify the order.
 */
export default function PayLinkForm({ token, order, gateways, defaultGateway }: PayLinkFormProps) {
  const [gateway, setGateway] = useState(defaultGateway ?? gateways[0]?.id ?? 'zarinpal');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payable = order.amount - order.discountAmount + order.shippingCost;
  const isPending = order.status === 'pending';

  async function handlePay() {
    setPaying(true);
    setError(null);

    try {
      const response = await fetch(`/api/pay/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        redirectUrl?: string;
        postUrl?: string | null;
        postFields?: Record<string, string> | null;
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? 'شروع پرداخت ناموفق بود.');
        setPaying(false);
        return;
      }

      if (payload.postUrl && payload.postFields) {
        // Relay gateways (Saman / Sepah / SizPay) take the browser there via a
        // form POST, not a redirect.
        submitRelay(payload.postUrl, payload.postFields);
        return;
      }

      if (payload.redirectUrl) {
        window.location.href = payload.redirectUrl;
        return;
      }

      setError('پاسخ پرداخت نامعتبر بود.');
      setPaying(false);
    } catch {
      setError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.');
      setPaying(false);
    }
  }

  return (
    <Stack gap="md" maw={640} w="100%" mx="auto">
      <Group justify="space-between" wrap="nowrap">
        <Title order={1} fz="h4">
          فاکتور سفارش {order.displayId}
        </Title>
        <Badge variant="light" color={STATUS_COLORS[order.status]}>
          {STATUS_LABELS[order.status]}
        </Badge>
      </Group>

      <Card withBorder padding="md">
        <Title order={2} fz="h6" mb="sm">
          اقلام سفارش
        </Title>
        <Stack gap="xs">
          {order.items.map((item) => (
            <Group
              key={`${item.productId}-${item.variantId ?? 'base'}`}
              justify="space-between"
              gap="xs"
              wrap="nowrap"
            >
              <Text size="sm" lineClamp={1}>
                {item.name}{' '}
                <Text component="span" size="sm" c="dimmed">
                  × {faNumber(item.qty)}
                </Text>
              </Text>
              <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
                {faCurrency(item.unitPrice * item.qty, false)}
              </Text>
            </Group>
          ))}
          <Divider />
          <Group justify="space-between">
            <Text fw={600}>جمع سفارش</Text>
            <Text fw={700}>{faCurrency(order.amount, false)}</Text>
          </Group>
          {order.discountAmount > 0 ? (
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm" c="green">
                تخفیف {order.couponCode ? `(${order.couponCode})` : ''}
              </Text>
              <Text size="sm" fw={700} c="green" style={{ whiteSpace: 'nowrap' }}>
                −{faCurrency(order.discountAmount, false)}
              </Text>
            </Group>
          ) : null}
          {order.deliveryMethod ? (
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap">
                <IconTruck size={14} />
                <Text size="sm" c={order.shippingCost > 0 ? undefined : 'dimmed'}>
                  هزینه ارسال ({order.deliveryMethod})
                </Text>
              </Group>
              <Text
                size="sm"
                fw={600}
                c={order.shippingCost > 0 ? undefined : 'dimmed'}
                style={{ whiteSpace: 'nowrap' }}
              >
                {order.shippingCost > 0
                  ? `+${faCurrency(order.shippingCost, false)}`
                  : 'پس‌کرایه (در فاکتور نمی‌آید)'}
              </Text>
            </Group>
          ) : null}
          <Divider />
          <Group justify="space-between">
            <Text fw={600}>مبلغ قابل پرداخت</Text>
            <Text fw={800}>{faCurrency(payable, false)}</Text>
          </Group>
          <Text size="xs" c="dimmed">
            تاریخ سفارش: {order.date}
          </Text>
        </Stack>
      </Card>

      {isPending ? (
        <Card withBorder padding="md">
          <Stack gap="sm">
            {gateways.length > 0 ? (
              <>
                <Text size="sm" fw={600}>
                  درگاه پرداخت
                </Text>
                <RadioGroup value={gateway} onChange={setGateway}>
                  <Stack gap={6}>
                    {gateways.map((option) => (
                      <Radio
                        key={option.id}
                        value={option.id}
                        label={
                          option.kind === 'bnpl'
                            ? `${option.label} (خرید اعتباری / اقساطی)`
                            : `${option.label} (پرداخت آنلاین)`
                        }
                        description={
                          option.kind === 'bnpl'
                            ? 'پرداخت اعتباری — مبلغ بعداً و طبق اقساط ارائه‌دهنده تسویه می‌شود'
                            : 'پرداخت مبلغ فاکتور با کارت بانکی'
                        }
                      />
                    ))}
                  </Stack>
                </RadioGroup>
                <Button
                  size="md"
                  leftSection={<IconCreditCard size={18} />}
                  loading={paying}
                  onClick={() => void handlePay()}
                >
                  پرداخت {faCurrency(payable, false)}
                </Button>
              </>
            ) : (
              <Text size="sm" c="dimmed">
                در حال حاضر درگاه پرداختی فعال نیست؛ لطفاً با فروشگاه تماس بگیرید.
              </Text>
            )}
          </Stack>
        </Card>
      ) : (
        <Alert
          variant="light"
          color={order.status === 'cancelled' ? 'red' : 'green'}
          icon={<IconCircleCheck size={18} />}
          title={
            order.status === 'cancelled' ? 'این فاکتور لغو شده است.' : 'این فاکتور پرداخت شده است.'
          }
        />
      )}

      {error ? (
        <Alert variant="light" color="red" icon={<IconAlertCircle size={18} />} title="خطا">
          {error}
        </Alert>
      ) : null}

      <Text size="xs" c="dimmed" ta="center">
        این صفحه فقط برای مشاهده و پرداخت فاکتور است؛ امکان تغییر اطلاعات سفارش وجود ندارد.
      </Text>
    </Stack>
  );
}
