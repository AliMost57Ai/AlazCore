'use client';

import { IconCalculator } from '@tabler/icons-react';
import { Badge, Card, Stack, Table, Text } from '@mantine/core';
import type { OrderAccountDTO } from '@/lib/accounting';
import { faCurrency } from '@/lib/format';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/order-status';

export interface AccountingTableProps {
  accounts: OrderAccountDTO[];
}

/**
 * The admin accounting list: one row per account-tied order with its full
 * money story — original (list) price, product discount, coupon discount, the
 * online (gateway) portion, the wallet portion, and refunds. Read-only.
 */
export default function AccountingTable({ accounts }: AccountingTableProps) {
  if (accounts.length === 0) {
    return (
      <Card withBorder padding="lg">
        <Stack gap={6} align="center" py="xl">
          <IconCalculator size={36} stroke={1.2} />
          <Text size="sm" c="dimmed">
            سفارشی برای نمایش وجود ندارد.
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Table.ScrollContainer minWidth={1020}>
      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>سفارش</Table.Th>
            <Table.Th>مشتری</Table.Th>
            <Table.Th>قیمت اصلی</Table.Th>
            <Table.Th>تخفیف فروشگاه</Table.Th>
            <Table.Th>کد تخفیف</Table.Th>
            <Table.Th>قابل پرداخت</Table.Th>
            <Table.Th>پرداخت آنلاین</Table.Th>
            <Table.Th>از کیف پول</Table.Th>
            <Table.Th>وضعیت</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {accounts.map((account) => (
            <Table.Tr key={account.id}>
              <Table.Td>
                <Stack gap={0}>
                  <Text size="sm" ff="monospace" fw={600}>
                    {account.displayId}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {account.date}
                  </Text>
                </Stack>
              </Table.Td>
              <Table.Td>
                <Stack gap={0}>
                  <Text size="sm" fw={600}>
                    {account.customerName}
                  </Text>
                  <Text size="xs" c="dimmed" dir="ltr" style={{ textAlign: 'end' }}>
                    {account.customerPhone ?? '—'}
                  </Text>
                </Stack>
              </Table.Td>
              <Table.Td>{faCurrency(account.baseAmount, false)}</Table.Td>
              <Table.Td>
                {account.productDiscount > 0 ? (
                  <Text size="sm" c="orange.7" fw={600}>
                    −{faCurrency(account.productDiscount, false)}
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    —
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                {account.couponCode ? (
                  <Stack gap={2}>
                    <Text size="xs" ff="monospace" fw={600}>
                      {account.couponCode}
                    </Text>
                    <Text size="xs" c="orange.7">
                      −{faCurrency(account.discountAmount, false)}
                    </Text>
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">
                    —
                  </Text>
                )}
              </Table.Td>
              <Table.Td fw={700}>{faCurrency(account.payable, false)}</Table.Td>
              <Table.Td>
                {account.onlinePaid > 0 ? (
                  <Text size="sm" fw={600}>
                    {faCurrency(account.onlinePaid, false)}
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    —
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                {account.walletPaid > 0 ? (
                  <Text size="sm" fw={600}>
                    {faCurrency(account.walletPaid, false)}
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    —
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Stack gap={4}>
                  <Badge
                    variant="light"
                    color={STATUS_COLORS[account.status]}
                    radius="sm"
                    size="sm"
                  >
                    {STATUS_LABELS[account.status]}
                  </Badge>
                  {account.refunded > 0 ? (
                    <Text size="xs" c="red">
                      بازگشت {faCurrency(account.refunded, false)}
                    </Text>
                  ) : null}
                </Stack>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
