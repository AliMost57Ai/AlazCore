'use client';

import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  ScrollArea,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconPencil, IconPlus, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react';

export interface TemplateRow {
  id: string;
  key: string;
  name: string;
  description: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  _count: { domains: number };
}

interface FormState {
  id?: string;
  key: string;
  name: string;
  description: string;
  isActive: boolean;
}

const EMPTY: FormState = { key: '', name: '', description: '', isActive: true };

export default function TemplatesClient({ templates }: { templates: TemplateRow[] }) {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(form.id ? `/api/templates/${form.id}` : '/api/templates', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        notifications.show({ message: data.error ?? 'ذخیره ناموفق بود.', color: 'crimson' });
        return;
      }
      notifications.show({ message: 'تم ذخیره شد.', color: 'brand' });
      setForm(null);
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  async function patch(row: TemplateRow, data: Partial<TemplateRow>) {
    const response = await fetch(`/api/templates/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      notifications.show({ message: body.error ?? 'تغییر ناموفق بود.', color: 'crimson' });
      return;
    }
    window.location.reload();
  }

  async function remove(row: TemplateRow) {
    if (!window.confirm(`تم «${row.name}» حذف شود؟`)) {
      return;
    }
    const response = await fetch(`/api/templates/${row.id}`, { method: 'DELETE' });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      notifications.show({ message: body.error ?? 'حذف ناموفق بود.', color: 'crimson' });
      return;
    }
    notifications.show({ message: 'تم حذف شد.', color: 'brand' });
    window.location.reload();
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" wrap="nowrap">
        <Title order={2}>مدیریت تم‌ها</Title>
        <Button radius="xl" leftSection={<IconPlus size={16} />} onClick={() => setForm(EMPTY)}>
          تعریف تم جدید
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {templates.map((template) => (
          <Card key={template.id} padding="lg" withBorder>
            <Group justify="space-between" mb="xs" wrap="nowrap">
              <Stack gap={0} style={{ minWidth: 0 }}>
                <Group gap={6} wrap="nowrap">
                  <Text fw={700} truncate>
                    {template.name}
                  </Text>
                  {template.isDefault ? (
                    <Badge size="sm" variant="light" color="brand" leftSection={<IconStarFilled size={10} />}>
                      پیش‌فرض
                    </Badge>
                  ) : null}
                </Group>
                <Text size="xs" c="dimmed" dir="ltr" ta="right">
                  {template.key}
                </Text>
              </Stack>
              <Group gap={4} wrap="nowrap">
                <Tooltip label="پیش‌فرض کردن">
                  <ActionIcon
                    variant="subtle"
                    color="brand"
                    disabled={template.isDefault}
                    onClick={() => patch(template, { isDefault: true })}
                  >
                    <IconStar size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="ویرایش">
                  <ActionIcon
                    variant="subtle"
                    onClick={() =>
                      setForm({
                        id: template.id,
                        key: template.key,
                        name: template.name,
                        description: template.description,
                        isActive: template.isActive,
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
                    disabled={template.isDefault}
                    onClick={() => remove(template)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>

            <Text size="sm" c="dimmed" mih={36}>
              {template.description || '—'}
            </Text>

            <Group justify="space-between" mt="md">
              <Text size="xs" c="dimmed">
                {template._count.domains.toLocaleString('en-US')} سایت مصرف‌کننده
              </Text>
              <Switch
                size="sm"
                checked={template.isActive}
                disabled={template.isDefault}
                onChange={(e) => patch(template, { isActive: e.currentTarget.checked })}
              />
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Card padding="lg" withBorder>
        <Title order={4} mb="md">
          جدول کامل
        </Title>
        <ScrollArea>
          <Table verticalSpacing="sm" style={{ minWidth: 640 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>کلید</Table.Th>
                <Table.Th>نام</Table.Th>
                <Table.Th>سایت‌ها</Table.Th>
                <Table.Th>وضعیت</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {templates.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td dir="ltr" ta="right">
                    {t.key}
                  </Table.Td>
                  <Table.Td>{t.name}</Table.Td>
                  <Table.Td>{t._count.domains.toLocaleString('en-US')}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {t.isDefault ? <Badge size="sm" color="brand" variant="light">پیش‌فرض</Badge> : null}
                      <Badge size="sm" color={t.isActive ? 'green' : 'gray'} variant="light">
                        {t.isActive ? 'فعال' : 'غیرفعال'}
                      </Badge>
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
        title={form?.id ? `ویرایش تم ${form.name}` : 'تعریف تم جدید'}
        size="md"
        centered
      >
        {form ? (
          <Stack gap="sm">
            <TextInput
              label="کلید تم (ThemeId)"
              description="با کلیدهای تم فروشگاه هم‌نام می‌شود؛ برای تم‌های جدید مثل custom-modern"
              placeholder="custom-modern"
              dir="ltr"
              disabled={Boolean(form.id)}
              required
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.currentTarget.value })}
            />
            <TextInput
              label="نام نمایشی"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
            />
            <Textarea
              label="توضیحات"
              autosize
              minRows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
            />
            {form.id ? (
              <Switch
                label="فعال"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.currentTarget.checked })}
              />
            ) : null}
            <Group justify="end" mt="md">
              <Button variant="subtle" onClick={() => setForm(null)}>
                انصراف
              </Button>
              <Button loading={saving} onClick={save}>
                ذخیره تم
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}
