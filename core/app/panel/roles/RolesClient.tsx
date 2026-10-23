'use client';

import { useState } from 'react';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  CORE_CAPABILITIES,
  CORE_MENUS,
  MENU_ACTION_LABELS,
  type MenuAction,
} from '@/lib/nav-permissions';

/**
 * جدول نقش‌های پنل Core — هم‌سان RolesTable فروشگاه: نمایشی برای گروه‌بندی
 * دسترسی پرسنل؛ نقش‌های سیستمی فقط عنوانشان عوض می‌شود و حذف‌شدنی نیستند.
 */

export interface CoreRoleRow {
  id: string;
  name: string;
  title: string;
  isAdmin: boolean;
  permissions: string[];
  userCount: number;
  isBuiltIn: boolean;
}

interface FormState {
  id?: string;
  name: string;
  title: string;
  isAdmin: boolean;
  permissions: string[];
}

const EMPTY: FormState = { name: '', title: '', isAdmin: false, permissions: [] };

function has(perms: string[], href: string, action: MenuAction): boolean {
  if (action === 'view') {
    return perms.includes(href) || perms.some((p) => p.startsWith(`${href}:`));
  }
  return perms.includes(`${href}:${action}`);
}

function toggle(perms: string[], href: string, action: MenuAction, checked: boolean): string[] {
  const bare = href;
  if (action === 'view') {
    // view = bare href؛ حذف view همهٔ grants همین href را هم پاک می‌کند.
    return checked
      ? [...perms.filter((p) => !p.startsWith(`${bare}:`)), bare]
      : perms.filter((p) => p !== bare && !p.startsWith(`${bare}:`));
  }
  if (checked) {
    return perms.includes(bare) || perms.some((p) => p.startsWith(`${bare}:`))
      ? [...new Set([...perms, `${bare}:${action}`])]
      : [...new Set([...perms, bare, `${bare}:${action}`])];
  }
  return perms.filter((p) => p !== `${bare}:${action}`);
}

export default function RolesClient({
  initialRoles,
  currentEmail,
}: {
  initialRoles: CoreRoleRow[];
  currentEmail: string;
}) {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form) {
      return;
    }
    setSaving(true);
    try {
      const body = form.id
        ? { title: form.title, isAdmin: form.isAdmin, permissions: form.permissions }
        : {
            name: form.name,
            title: form.title,
            isAdmin: form.isAdmin,
            permissions: form.permissions,
          };
      const response = await fetch(form.id ? `/api/roles/${form.id}` : '/api/roles', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        notifications.show({ message: data.error ?? 'ذخیره ناموفق بود.', color: 'crimson' });
        return;
      }
      notifications.show({ message: 'نقش ذخیره شد.', color: 'brand' });
      setForm(null);
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  async function remove(role: CoreRoleRow) {
    if (!window.confirm(`نقش «${role.title}» حذف شود؟`)) {
      return;
    }
    const response = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      notifications.show({ message: data.error ?? 'حذف ناموفق بود.', color: 'crimson' });
      return;
    }
    notifications.show({ message: 'نقش حذف شد.', color: 'brand' });
    window.location.reload();
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" wrap="nowrap">
        <Title order={2}>نقش‌ها</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setForm(EMPTY)}>
          نقش جدید
        </Button>
      </Group>

      <Card padding="lg" withBorder>
        <ScrollArea>
          <Table highlightOnHover verticalSpacing="sm" style={{ minWidth: 720 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>عنوان</Table.Th>
                <Table.Th>نام ماشین</Table.Th>
                <Table.Th>کاربران</Table.Th>
                <Table.Th>دسترسی</Table.Th>
                <Table.Th>عملیات</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {initialRoles.map((role) => (
                <Table.Tr key={role.id}>
                  <Table.Td fw={600}>{role.title}</Table.Td>
                  <Table.Td dir="ltr" ta="right" c="dimmed">
                    {role.name}
                  </Table.Td>
                  <Table.Td>{role.userCount.toLocaleString('en-US')}</Table.Td>
                  <Table.Td>
                    {role.isAdmin ? (
                      <Badge variant="light" color="brand">
                        دسترسی کامل
                      </Badge>
                    ) : (
                      <Badge variant="light" color="blue">
                        {role.permissions.length.toLocaleString('en-US')} مجوز
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label="ویرایش">
                        <ActionIcon
                          variant="subtle"
                          onClick={() =>
                            setForm({
                              id: role.id,
                              name: role.name,
                              title: role.title,
                              isAdmin: role.isAdmin,
                              permissions: role.permissions,
                            })
                          }
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="حذف">
                        <ActionIcon
                          variant="subtle"
                          color="crimson"
                          disabled={role.isBuiltIn}
                          onClick={() => remove(role)}
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

      <Modal
        opened={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? `ویرایش نقش ${form.title}` : 'نقش جدید'}
        size="lg"
        centered
      >
        {form ? (
          <Stack gap="sm">
            <Group grow>
              <TextInput
                label="عنوان نمایشی"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.currentTarget.value })}
              />
              <TextInput
                label="نام ماشین"
                dir="ltr"
                required
                disabled={Boolean(form.id)}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
              />
            </Group>

            <Switch
              label="دسترسی کامل مدیر (همه منوها)"
              checked={form.isAdmin}
              onChange={(e) => setForm({ ...form, isAdmin: e.currentTarget.checked })}
            />

            {!form.isAdmin ? (
              <Stack gap="xs">
                {CORE_MENUS.map((group) => (
                  <div key={group.id}>
                    <Text size="sm" fw={600} mb={4}>
                      {group.label}
                    </Text>
                    {group.items.map((item) => (
                      <Group key={item.href} gap="lg" ml="sm">
                        <Text size="sm" w={160}>
                          {item.label}
                        </Text>
                        {(['view', 'edit', 'add'] as MenuAction[]).map((action) => (
                          <Checkbox
                            key={action}
                            label={MENU_ACTION_LABELS[action]}
                            checked={has(form.permissions, item.href, action)}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                permissions: toggle(
                                  form.permissions,
                                  item.href,
                                  action,
                                  e.currentTarget.checked
                                ),
                              })
                            }
                          />
                        ))}
                      </Group>
                    ))}
                  </div>
                ))}

                <Text size="sm" fw={600} mt="sm" mb={4}>
                  قابلیت‌های ویژه
                </Text>
                {CORE_CAPABILITIES.map((capability) => (
                  <Checkbox
                    key={capability.entry}
                    label={
                      <Text size="sm">
                        {capability.label}
                        <Text component="span" size="xs" c="dimmed">
                          {' '}
                          — {capability.description}
                        </Text>
                      </Text>
                    }
                    checked={form.permissions.includes(capability.entry)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        permissions: e.currentTarget.checked
                          ? [...form.permissions, capability.entry]
                          : form.permissions.filter((item) => item !== capability.entry),
                      })
                    }
                  />
                ))}
              </Stack>
            ) : null}

            <Group justify="end" mt="md">
              <Button variant="subtle" onClick={() => setForm(null)}>
                انصراف
              </Button>
              <Button loading={saving} onClick={save}>
                ذخیره نقش
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}
