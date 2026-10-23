'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Anchor,
  Badge,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import type { CustomerFile } from '@/lib/customers';
import { faCurrency, faNumber } from '@/lib/format';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/order-status';
import { TICKET_STATUS_COLORS, TICKET_STATUS_LABELS } from '@/lib/support-status';

const TIER_COLORS: Record<string, string> = {
  طلایی: 'yellow',
  نقره‌ای: 'gray',
  برنزی: 'orange',
};

export interface CustomerFileProps {
  file: CustomerFile;
  /**
   * Whether the viewer may open a ticket (/support). The file is reachable by
   * staff who hold only '/customers', and for them a «مشاهده گفتگو» link would
   * bounce off the support guard straight back to the dashboard — the row's
   * facts still belong in the file, so only the link is dropped.
   */
  canViewTickets: boolean;
}

/** A titled card with an optional line of context under the heading. */
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card withBorder padding="md">
      <Stack gap={4} mb="sm">
        <Title order={2} fz="h6">
          {title}
        </Title>
        {hint ? (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        ) : null}
      </Stack>
      {children}
    </Card>
  );
}

/** The plain «nothing recorded here» line every section falls back to. */
function Empty({ children }: { children: ReactNode }) {
  return (
    <Text size="sm" c="dimmed" py="sm">
      {children}
    </Text>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600} c={color}>
        {value}
      </Text>
    </Stack>
  );
}

/**
 * The customer's full activity record — the page behind «مشاهدهٔ پروندهٔ مشتری».
 *
 * A client component for the same reason the other panel tables are: Mantine's
 * compound properties (`Table.ScrollContainer`) are not reliably present when a
 * server component renders them, because @mantine/core ships
 * sideEffects: ["*.css"] and a bundler may drop the property assignments.
 *
 * Strictly read-only. Every mutation (wallet adjustment, blocking, order
 * status) stays on the page that owns it, with its own permission check — a
 * supporter reading a ticket must never be handed a write by accident.
 */
export default function CustomerFileView({ file, canViewTickets }: CustomerFileProps) {
  const basket = file.orders.find((order) => order.isBasket) ?? null;

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={2}>
            <Group gap="xs">
              <Text fw={700} fz="h5">
                {file.name}
              </Text>
              {file.isBlocked ? (
                <Badge variant="light" color="red" radius="sm" size="sm">
                  مسدود
                </Badge>
              ) : null}
              <Badge variant="light" color={TIER_COLORS[file.tier] ?? 'gray'} radius="sm" size="sm">
                {file.tier}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed" dir="ltr" ta="start">
              {file.phone}
            </Text>
            {file.email ? (
              <Text size="xs" c="dimmed" dir="ltr" ta="start">
                {file.email}
              </Text>
            ) : null}
            {file.nationalId ? (
              <Text size="xs" c="dimmed" dir="ltr" ta="start">
                کد ملی: {file.nationalId}
              </Text>
            ) : null}
          </Stack>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Stat label="سفارش‌ها" value={faNumber(file.orderCount)} />
            <Stat label="مجموع خرید" value={faCurrency(file.spent, false)} />
            <Stat
              label="کیف پول"
              value={faCurrency(file.walletBalance, false)}
              color={file.walletBalance > 0 ? 'teal' : undefined}
            />
            <Stat label="عضویت" value={file.since} />
          </SimpleGrid>
        </Group>
      </Card>

      <Section
        title="سفارش‌ها و سبد خرید"
        hint={
          basket
            ? `سبد فعال: ${basket.displayId} — ${faCurrency(basket.amount, false)}`
            : 'سفارش پرداخت‌نشدهٔ فعالی ندارد.'
        }
      >
        {file.orders.length === 0 ? (
          <Empty>این مشتری هنوز سفارشی ثبت نکرده است.</Empty>
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>سفارش</Table.Th>
                  <Table.Th>اقلام</Table.Th>
                  <Table.Th>مبلغ</Table.Th>
                  <Table.Th>وضعیت</Table.Th>
                  <Table.Th>کد رهگیری</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {file.orders.map((order) => (
                  <Table.Tr key={order.id}>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm" ff="monospace" fw={600}>
                          {order.displayId}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {order.date}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        {order.items.length === 0 ? (
                          <Text size="xs" c="dimmed">
                            —
                          </Text>
                        ) : (
                          order.items.map((item) => (
                            <Text key={`${order.id}-${item.name}`} size="xs" c="dimmed">
                              {item.name} × {faNumber(item.qty)}
                            </Text>
                          ))
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {faCurrency(order.amount, false)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Badge
                          variant="light"
                          color={STATUS_COLORS[order.status]}
                          radius="sm"
                          size="sm"
                        >
                          {STATUS_LABELS[order.status]}
                        </Badge>
                        {order.isBasket ? (
                          <Badge variant="light" color="blue" radius="sm" size="sm">
                            سبد فعال
                          </Badge>
                        ) : null}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" dir="ltr" ta="start">
                        {order.trackingCode ?? '—'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Section>

      <Section title="کیف پول" hint={`موجودی فعلی: ${faCurrency(file.walletBalance, false)}`}>
        {file.walletLines.length === 0 ? (
          <Empty>تراکنشی در کیف پول این مشتری ثبت نشده است.</Empty>
        ) : (
          <Table.ScrollContainer minWidth={560}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>تاریخ</Table.Th>
                  <Table.Th>شرح</Table.Th>
                  <Table.Th>مبلغ</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {file.walletLines.map((line) => (
                  <Table.Tr key={line.id}>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {line.date}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{line.label}</Text>
                      {line.reason ? (
                        <Text size="xs" c="dimmed">
                          {line.reason}
                        </Text>
                      ) : null}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={600} c={line.amount >= 0 ? 'teal' : undefined}>
                        {line.amount >= 0 ? '+' : '−'}
                        {faCurrency(Math.abs(line.amount), false)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Section>

      <Section title="تراکنش‌های درگاه" hint="هر تلاش پرداخت، موفق یا ناموفق.">
        {file.payments.length === 0 ? (
          <Empty>پرداخت آنلاینی برای این مشتری ثبت نشده است.</Empty>
        ) : (
          <Table.ScrollContainer minWidth={720}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>تاریخ</Table.Th>
                  <Table.Th>نوع</Table.Th>
                  <Table.Th>مبلغ</Table.Th>
                  <Table.Th>سفارش</Table.Th>
                  <Table.Th>کد پیگیری</Table.Th>
                  <Table.Th>وضعیت</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {file.payments.map((payment) => (
                  <Table.Tr key={payment.id}>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {payment.date}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{payment.kindLabel}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {faCurrency(payment.amount, false)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace">
                        {payment.orderDisplayId ?? '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" dir="ltr" ta="start">
                        {payment.refId ?? '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        radius="sm"
                        size="sm"
                        color={
                          payment.state === 'verified'
                            ? 'teal'
                            : payment.state === 'failed'
                              ? 'red'
                              : 'orange'
                        }
                      >
                        {payment.stateLabel}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Section>

      <Section title="تیکت‌های پشتیبانی" hint={`${faNumber(file.tickets.length)} گفتگو`}>
        {file.tickets.length === 0 ? (
          <Empty>این مشتری تیکتی ثبت نکرده است.</Empty>
        ) : (
          <Table.ScrollContainer minWidth={680}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>تیکت</Table.Th>
                  <Table.Th>موضوع</Table.Th>
                  <Table.Th>وضعیت</Table.Th>
                  <Table.Th>آخرین پیام</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {file.tickets.map((ticket) => (
                  <Table.Tr key={ticket.id}>
                    <Table.Td>
                      <Text size="sm" ff="monospace" fw={600}>
                        {ticket.displayId}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1} maw={260}>
                        {ticket.subject}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Badge variant="light" color={TICKET_STATUS_COLORS[ticket.status]}>
                          {TICKET_STATUS_LABELS[ticket.status]}
                        </Badge>
                        {ticket.unread ? (
                          <Badge size="xs" color="red" variant="filled">
                            خوانده‌نشده
                          </Badge>
                        ) : null}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {ticket.lastMessageDate}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {canViewTickets ? (
                        <Anchor component={Link} href={`/support/${ticket.id}`} size="sm" c="brand">
                          مشاهده گفتگو
                        </Anchor>
                      ) : (
                        <Text size="xs" c="dimmed">
                          —
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Section>

      <Section title="کدهای تخفیف مصرف‌شده">
        {file.coupons.length === 0 ? (
          <Empty>این مشتری از هیچ کد تخفیفی استفاده نکرده است.</Empty>
        ) : (
          <Stack gap="xs">
            {file.coupons.map((coupon) => (
              <Group key={coupon.id} justify="space-between" gap="xs" wrap="nowrap">
                <Text size="sm" ff="monospace">
                  {coupon.code}
                </Text>
                <Group gap="md" wrap="nowrap">
                  <Text size="sm" fw={600}>
                    {coupon.valueLabel}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {coupon.date}
                  </Text>
                </Group>
              </Group>
            ))}
          </Stack>
        )}
      </Section>

      <Section title="آدرس‌ها" hint={`${faNumber(file.addresses.length)} آدرس ثبت‌شده`}>
        {file.addresses.length === 0 ? (
          <Empty>آدرسی برای این مشتری ثبت نشده است.</Empty>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {file.addresses.map((address) => (
              <Card key={address.id} withBorder padding="sm">
                <Group justify="space-between" gap="xs" mb={4}>
                  <Text size="sm" fw={600}>
                    {address.title}
                  </Text>
                  {address.postalCode ? (
                    <Text size="xs" c="dimmed" dir="ltr">
                      {address.postalCode}
                    </Text>
                  ) : null}
                </Group>
                <Divider mb="xs" />
                <Text size="xs" c="dimmed">
                  {address.receiverName} — {address.receiverPhone}
                </Text>
                <Text size="xs" mt={4}>
                  {address.body}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Section>
    </Stack>
  );
}
