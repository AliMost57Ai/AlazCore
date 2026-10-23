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
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { faDate } from '@/lib/format';

export interface CoreUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * فهرست کاربران پنل Core — ایجاد/ویرایش روی صفحات اختصاصی (/panel/users/new و
 * /panel/users/[id]/edit — فرم‌های بیش از ۴ فیلد مودال باز نمی‌شوند)؛ حذف
 * همین‌جاست.
 */
export default function UsersClient({
  users,
  currentEmail,
}: {
  users: CoreUserRow[];
  currentEmail: string;
}) {
  async function remove(user: CoreUserRow) {
    if (!window.confirm(`کاربر ${user.name} حذف شود؟`)) {
      return;
    }
    const response = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      notifications.show({ message: data.error ?? 'حذف ناموفق بود.', color: 'crimson' });
      return;
    }
    notifications.show({ message: 'کاربر حذف شد.', color: 'brand' });
    window.location.reload();
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" wrap="nowrap">
        <Title order={2}>کاربران پنل Core</Title>
        <Button
          radius="xl"
          leftSection={<IconPlus size={16} />}
          component={Link}
          href="/panel/users/new"
        >
          کاربر جدید
        </Button>
      </Group>

      <Card padding="lg" withBorder>
        <ScrollArea>
          <Table highlightOnHover verticalSpacing="sm" style={{ minWidth: 720 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>نام</Table.Th>
                <Table.Th>ایمیل</Table.Th>
                <Table.Th>نقش</Table.Th>
                <Table.Th>وضعیت</Table.Th>
                <Table.Th>تاریخ ساخت</Table.Th>
                <Table.Th>عملیات</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td fw={600}>
                    {user.name}
                    {user.email === currentEmail ? (
                      <Badge size="sm" variant="light" color="brand" ml={6}>
                        شما
                      </Badge>
                    ) : null}
                  </Table.Td>
                  <Table.Td dir="ltr" ta="right">
                    {user.email}
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={user.role === 'superadmin' ? 'brand' : 'blue'}>
                      {user.role === 'superadmin' ? 'مدیر کل' : 'پشتیبان'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={user.isActive ? 'green' : 'gray'}>
                      {user.isActive ? 'فعال' : 'غیرفعال'}
                    </Badge>
                  </Table.Td>
                  <Table.Td c="dimmed">{faDate(user.createdAt)}</Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label="ویرایش">
                        <ActionIcon
                          component={Link}
                          href={`/panel/users/${user.id}/edit`}
                          variant="subtle"
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="حذف">
                        <ActionIcon
                          variant="subtle"
                          color="crimson"
                          disabled={user.email === currentEmail}
                          onClick={() => remove(user)}
                        >
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
