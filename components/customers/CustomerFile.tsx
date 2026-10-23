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
import { enCurrency, enNumber } from '@/lib/format';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/order-status';
import {
  RETURN_STATUS_COLORS,
  RETURN_STATUS_LABELS,
  type ReturnStatus,
} from '@/lib/return-status';
import { TICKET_STATUS_COLORS, TICKET_STATUS_LABELS } from '@/lib/ticket-status';

const TIER_COLORS: Record<string, string> = {
  طلایی: 'yellow',
  نقره‌ای: 'gray',
  برنزی: 'orange',
};

export interface CustomerFileProps {
  file: CustomerFile;
  /**
   * آیا بیننده می‌تواند گفتگو را باز کند (منوی /customer-support). پرونده برای
   * پرسنلی که فقط '/customers' دارد هم باز می‌شود و برای او لینک «مشاهده گفتگو»
   * به گارد پشتیبانی می‌خورد — واقعیت‌های ردیف باید بمانند، فقط لینک حذف می‌شود.
   */
  canViewTickets: boolean;
  /** همین قاعده برای لینک جزئیات مرجوعی (/returns). */
  canViewReturns: boolean;
}

/** کارت عنوان‌دار با یک خط راهنما زیر عنوان. */
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

/** خط «چیزی ثبت نشده» که هر بخش به آن برمی‌گردد. */
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
 * سابقهٔ کامل مشتری — صفحه پشت «مشاهدهٔ پروندهٔ مشتری» (پورت نسخه مرجع).
 *
 * کلاینت است به همان دلیل جدول‌های دیگر پنل: پراپرتی‌های ترکیبی منتین
 * (Table.ScrollContainer) در RSC مطمئن رندر نمی‌شوند.
 *
 * سرتاسر فقط-خواندنی؛ هر تغییری در صفحه مالک خودش با گارد خودش می‌ماند.
 */
export default function CustomerFileView({
  file,
  canViewTickets,
  canViewReturns,
}: CustomerFileProps) {
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
            <Stat label="سفارش‌ها" value={enNumber(file.orderCount)} />
            <Stat label="مجموع خرید" value={enCurrency(file.spent, false)} />
            <Stat
              label="کیف پول"
              value={enCurrency(file.walletBalance, false)}
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
            ? `سبد فعال: ${basket.displayId} — ${enCurrency(basket.amount, false)}`
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
                              {item.name} × {enNumber(item.qty)}
                            </Text>
                          ))
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {enCurrency(order.amount, false)}
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

      <Section title="مرجوعی‌ها" hint={`${enNumber(file.returns.length)} درخواست`}>
        {file.returns.length === 0 ? (
          <Empty>این مشتری درخواست مرجوعی ثبت نکرده است.</Empty>
        ) : (
          <Table.ScrollContainer minWidth={680}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>مرجوعی</Table.Th>
                  <Table.Th>سفارش</Table.Th>
                  <Table.Th>تاریخ</Table.Th>
                  <Table.Th>مبلغ بازگشتی</Table.Th>
                  <Table.Th>وضعیت</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {file.returns.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      <Text size="sm" ff="monospace" fw={600}>
                        {item.displayId}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace" c="dimmed">
                        {item.orderDisplayId}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {item.dateLabel}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {enCurrency(item.amount, false)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        size="sm"
                        radius="sm"
                        color={RETURN_STATUS_COLORS[item.status as ReturnStatus] ?? 'gray'}
                      >
                        {RETURN_STATUS_LABELS[item.status as ReturnStatus] ?? item.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {canViewReturns ? (
                        <Anchor
                          component={Link}
                          href={`/returns/${encodeURIComponent(item.displayId)}`}
                          size="sm"
                          c="brand"
                        >
                          جزئیات
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

      <Section title="کیف پول" hint={`موجودی فعلی: ${enCurrency(file.walletBalance, false)}`}>
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
                        {enCurrency(Math.abs(line.amount), false)}
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
                        {enCurrency(payment.amount, false)}
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

      <Section title="تیکت‌های پشتیبانی" hint={`${enNumber(file.tickets.length)} گفتگو`}>
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
                        <Badge
                          variant="light"
                          color={
                            TICKET_STATUS_COLORS[
                              ticket.status as keyof typeof TICKET_STATUS_COLORS
                            ] ?? 'gray'
                          }
                        >
                          {TICKET_STATUS_LABELS[
                            ticket.status as keyof typeof TICKET_STATUS_LABELS
                          ] ?? ticket.status}
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
                        <Anchor
                          component={Link}
                          href={`/customer-support/${ticket.id}`}
                          size="sm"
                          c="brand"
                        >
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

      <Section title="آدرس‌ها" hint={`${enNumber(file.addresses.length)} آدرس ثبت‌شده`}>
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
