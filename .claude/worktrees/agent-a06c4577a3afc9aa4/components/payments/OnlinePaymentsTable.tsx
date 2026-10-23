'use client';

import { IconCreditCard } from '@tabler/icons-react';
import { Badge, Card, Stack, Table, Text } from '@mantine/core';
import { faCurrency } from '@/lib/format';
import {
  PAYMENT_KIND_LABELS,
  PAYMENT_STATE_LABELS,
  type AdminOnlinePaymentDTO,
} from '@/lib/wallet';

const STATE_COLORS: Record<AdminOnlinePaymentDTO['state'], string> = {
  pending: 'yellow',
  verified: 'green',
  failed: 'red',
};

export interface OnlinePaymentsTableProps {
  payments: AdminOnlinePaymentDTO[];
}

/**
 * The admin online-payments list: every payment attempt across all customers
 * with its state — read-only, so no actions to wire up.
 */
export default function OnlinePaymentsTable({ payments }: OnlinePaymentsTableProps) {
  if (payments.length === 0) {
    return (
      <Card withBorder padding="lg">
        <Stack gap={6} align="center" py="xl">
          <IconCreditCard size={36} stroke={1.2} />
          <Text size="sm" c="dimmed">
            تراکنش درگاه موجود نیست.
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Table.ScrollContainer minWidth={820}>
      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>تاریخ</Table.Th>
            <Table.Th>مشتری</Table.Th>
            <Table.Th>نوع</Table.Th>
            <Table.Th>مبلغ</Table.Th>
            <Table.Th>وضعیت</Table.Th>
            <Table.Th>کد پیگیری</Table.Th>
            <Table.Th>سفارش</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {payments.map((payment) => (
            <Table.Tr key={payment.id}>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {payment.date}
                </Text>
              </Table.Td>
              <Table.Td>
                <Stack gap={0}>
                  <Text size="sm" fw={600}>
                    {payment.userName}
                  </Text>
                  <Text size="xs" c="dimmed" dir="ltr" style={{ textAlign: 'end' }}>
                    {payment.userPhone ?? '—'}
                  </Text>
                </Stack>
              </Table.Td>
              <Table.Td>
                <Badge variant="light" color="blue" radius="sm" size="sm">
                  {PAYMENT_KIND_LABELS[payment.kind]}
                </Badge>
              </Table.Td>
              <Table.Td fw={600}>{faCurrency(payment.amount, false)}</Table.Td>
              <Table.Td>
                <Badge variant="light" color={STATE_COLORS[payment.state]} radius="sm" size="sm">
                  {PAYMENT_STATE_LABELS[payment.state]}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" ff="monospace" dir="ltr">
                  {payment.refId ? Number(payment.refId) : '—'}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" ff="monospace">
                  {payment.orderDisplayId ?? '—'}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
