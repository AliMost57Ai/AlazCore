'use client';

import Link from 'next/link';
import { notifications } from '@mantine/notifications';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Switch,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';

export interface PlanRow {
  id: string;
  name: string;
  description: string;
  menus: string[];
  limits: Record<string, unknown>;
  isActive: boolean;
  durationDays: number | null;
  priceMonthly: number;
  _count: { domains: number };
}

export default function PlansClient({ plans }: { plans: PlanRow[] }) {
  async function toggleActive(plan: PlanRow) {
    const response = await fetch(`/api/plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !plan.isActive }),
    });
    if (response.ok) {
      window.location.reload();
    }
  }

  async function remove(plan: PlanRow) {
    if (!window.confirm(`پلن «${plan.name}» حذف شود؟ دامین‌های متصل بدون پلن می‌شوند.`)) {
      return;
    }
    const response = await fetch(`/api/plans/${plan.id}`, { method: 'DELETE' });
    if (response.ok) {
      notifications.show({ message: 'پلن حذف شد.', color: 'brand' });
      window.location.reload();
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" wrap="nowrap">
        <Title order={2}>مدیریت پلن‌ها</Title>
        <Button
          radius="xl"
          leftSection={<IconPlus size={16} />}
          component={Link}
          href="/panel/plans/new"
        >
          تعریف پلن جدید
        </Button>
      </Group>

      <Card padding="lg" withBorder>
        <ScrollArea>
          <Table highlightOnHover verticalSpacing="sm" style={{ minWidth: 800 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>پلن</Table.Th>
                <Table.Th>قیمت ماهانه</Table.Th>
                <Table.Th>مدت اعتبار</Table.Th>
                <Table.Th>منوها</Table.Th>
                <Table.Th>دامنه‌ها</Table.Th>
                <Table.Th>وضعیت</Table.Th>
                <Table.Th>عملیات</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {plans.map((plan) => (
                <Table.Tr key={plan.id}>
                  <Table.Td>
                    <Stack gap={0}>
                      <Text fw={600}>{plan.name}</Text>
                      {plan.description ? (
                        <Text size="xs" c="dimmed">
                          {plan.description}
                        </Text>
                      ) : null}
                    </Stack>
                  </Table.Td>
                  <Table.Td>{plan.priceMonthly.toLocaleString('en-US')} تومان</Table.Td>
                  <Table.Td>
                    {plan.durationDays ? `${plan.durationDays.toLocaleString('en-US')} روز` : 'نامحدود'}
                  </Table.Td>
                  <Table.Td>
                    {plan.menus.includes('*') ? (
                      <Badge variant="light" color="brand">
                        همه منوها
                      </Badge>
                    ) : (
                      <Badge variant="light" color="blue">
                        {plan.menus.length.toLocaleString('en-US')} منو
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{plan._count.domains.toLocaleString('en-US')}</Table.Td>
                  <Table.Td>
                    <Switch
                      size="sm"
                      checked={plan.isActive}
                      onChange={() => toggleActive(plan)}
                      aria-label="فعال/غیرفعال"
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label="ویرایش">
                        <ActionIcon
                          component={Link}
                          href={`/panel/plans/${plan.id}/edit`}
                          variant="subtle"
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="حذف">
                        <ActionIcon variant="subtle" color="crimson" onClick={() => remove(plan)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

    </Stack>
  );
}
