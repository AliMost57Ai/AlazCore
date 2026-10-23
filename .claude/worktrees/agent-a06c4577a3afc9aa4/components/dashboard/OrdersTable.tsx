'use client';

import {
  IconAlertTriangle,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconPackage,
  IconTruck,
} from '@tabler/icons-react';
import { Badge, Box, Card, Group, Stack, Table, Text } from '@mantine/core';
import FulfillmentControls from '@/components/orders/FulfillmentControls';
import { faCurrency } from '@/lib/format';
import { STATUS_COLORS, STATUS_LABELS, type Order, type OrderStatus } from '@/lib/orders';
import classes from './OrdersTable.module.css';

const STATUS_ICONS: Record<OrderStatus, typeof IconCheck> = {
  paid: IconCheck,
  pending: IconClock,
  boxing: IconPackage,
  posted: IconTruck,
  shipped: IconTruck,
  delivered: IconCircleCheck,
  cancelled: IconAlertTriangle,
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const Icon = STATUS_ICONS[status];

  return (
    // Icon + text, never colour alone: `pending` (yellow) sits under 3:1 on a
    // light surface, so the label is what actually carries the state.
    <Badge
      variant="light"
      color={STATUS_COLORS[status]}
      leftSection={<Icon size={12} stroke={2.5} />}
      radius="sm"
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export interface OrdersTableProps {
  /** Rows to show — the server page slices/queries as needed. */
  orders: Order[];
  /** Renders the fulfillment actions (boxing → posted → notice) for roles
   *  with the orders:edit grant — the API enforces it regardless. */
  canEdit?: boolean;
}

export default function OrdersTable({ orders, canEdit = false }: OrdersTableProps) {
  const tracking = (order: Order) =>
    order.trackingCode ? (
      <Text size="xs" ff="monospace" dir="ltr" ta="start" c="dimmed">
        {order.trackingCode}
      </Text>
    ) : null;

  return (
    <>
      {/* Desktop: a real table. */}
      <Box visibleFrom="sm">
        <Table verticalSpacing="sm" highlightOnHover className={classes.table}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>شناسه سفارش</Table.Th>
              <Table.Th>مشتری</Table.Th>
              <Table.Th>تاریخ</Table.Th>
              <Table.Th className={classes.numeric}>مبلغ</Table.Th>
              <Table.Th>وضعیت</Table.Th>
              {canEdit ? <Table.Th>عملیات</Table.Th> : null}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {orders.map((order) => (
              <Table.Tr key={order.id}>
                <Table.Td>
                  <Text size="sm" ff="monospace" dir="ltr" ta="start">
                    {order.id}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {order.customer}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" className={classes.numeric}>
                    {order.date}
                  </Text>
                </Table.Td>
                <Table.Td className={classes.numeric}>
                  <Text size="sm" fw={600}>
                    {faCurrency(order.amount, false)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Stack gap={4}>
                    <StatusBadge status={order.status} />
                    {tracking(order)}
                  </Stack>
                </Table.Td>
                {canEdit ? (
                  <Table.Td>
                    <FulfillmentControls order={order} />
                  </Table.Td>
                ) : null}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>

      {/* Mobile: one card per order. A five-column table cannot be read on a
          360px screen, and horizontal scrolling hides the amount. */}
      <Stack gap="sm" hiddenFrom="sm">
        {orders.map((order) => (
          <Card key={order.id} padding="sm" radius="md">
            <Group justify="space-between" wrap="nowrap" gap="xs" mb={6}>
              <Text size="sm" fw={600} truncate>
                {order.customer}
              </Text>
              <StatusBadge status={order.status} />
            </Group>

            <Group justify="space-between" wrap="nowrap" gap="xs">
              <Text size="xs" c="dimmed" ff="monospace" dir="ltr">
                {order.id}
              </Text>
              <Text size="xs" c="dimmed" className={classes.numeric}>
                {order.date}
              </Text>
            </Group>

            <Text size="sm" fw={700} mt={8} className={classes.numeric}>
              {faCurrency(order.amount, false)}
            </Text>

            {order.trackingCode ? (
              <Text size="xs" c="dimmed" mt={4}>
                کد رهگیری:{' '}
                <Text span ff="monospace" dir="ltr">
                  {order.trackingCode}
                </Text>
              </Text>
            ) : null}

            {canEdit ? (
              <Group justify="flex-end" mt="xs">
                <FulfillmentControls order={order} />
              </Group>
            ) : null}
          </Card>
        ))}
      </Stack>
    </>
  );
}
