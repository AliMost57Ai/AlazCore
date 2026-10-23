'use client';

import { notifications } from '@mantine/notifications';
import {
  Badge,
  Button,
  Card,
  Group,
  Image,
  Modal,
  ScrollArea,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { IconPencil } from '@tabler/icons-react';
import PageHeader from './PageHeader';

export interface CatalogRow {
  id: string;
  label: string;
  isActive: boolean;
  logoPath: string | null;
  /** شمار دامین‌های تخصیص‌یافته — فقط نمایشی. */
  usageCount: number;
}

/**
 * جدول مدیریت کاتالوگ (درگاه/اقساط/پیامک) — سوییچ فعال/غیرفعال + ویرایش
 * نام و آپلود لوگو. غیرفعال‌شدن فقط از تخصیصِ جدید جلوگیری می‌کند؛
 * سایت‌هایی که قبلاً گرفته‌اند همچنان استفاده می‌کنند.
 */
export default function CatalogManager({
  title,
  description,
  rows,
  apiBase,
}: {
  title: string;
  description: string;
  rows: CatalogRow[];
  /** مسیر API برای PATCH (isActive / نام / لوگو). */
  apiBase: string;
}) {
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function openEdit(row: CatalogRow) {
    setEditing(row);
    setLabel(row.label);
    setFile(null);
  }

  async function saveEdit() {
    if (!editing) {
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.set('label', label);
      if (file) {
        form.set('logo', file);
      }
      const response = await fetch(`${apiBase}/${editing.id}`, {
        method: 'PATCH',
        body: form,
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        notifications.show({ message: data.error ?? 'ذخیره ناموفق بود.', color: 'crimson' });
        return;
      }
      notifications.show({ message: 'کاتالوگ به‌روزرسانی شد.', color: 'brand' });
      setEditing(null);
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row: CatalogRow, next: boolean) {
    const response = await fetch(`${apiBase}/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: next }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      notifications.show({ message: data.error ?? 'تغییر ناموفق بود.', color: 'crimson' });
      return;
    }
    window.location.reload();
  }

  return (
    <Stack gap="lg">
      <PageHeader title={title} description={description} />
      <Card padding="lg" withBorder>

        <ScrollArea>
          <Table highlightOnHover verticalSpacing="sm" style={{ minWidth: 720 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={64}>لوگو</Table.Th>
                <Table.Th>نام</Table.Th>
                <Table.Th>شناسه</Table.Th>
                <Table.Th>دامنه‌های متصل</Table.Th>
                <Table.Th>وضعیت</Table.Th>
                <Table.Th w={60} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.id} opacity={row.isActive ? 1 : 0.65}>
                  <Table.Td>
                    {row.logoPath ? (
                      <Image
                        src={`/api/catalog/logo/${apiBase.split('/').pop()}/${row.id}`}
                        alt={row.label}
                        w={34}
                        h={34}
                        fit="contain"
                        radius="sm"
                        style={{ background: '#fff' }}
                      />
                    ) : (
                      <Text size="xs" c="dimmed" ta="center">
                        —
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td fw={600}>{row.label}</Table.Td>
                  <Table.Td dir="ltr" ta="right" c="dimmed">
                    {row.id}
                  </Table.Td>
                  <Table.Td>{row.usageCount.toLocaleString('en-US')}</Table.Td>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <Switch
                        size="sm"
                        checked={row.isActive}
                        onChange={(e) => toggle(row, e.currentTarget.checked)}
                        aria-label={`فعال/غیرفعال ${row.label}`}
                      />
                      <Badge size="sm" variant="light" color={row.isActive ? 'green' : 'gray'}>
                        {row.isActive ? 'فعال' : 'غیرفعال'}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      leftSection={<IconPencil size={14} />}
                      onClick={() => openEdit(row)}
                    >
                      ویرایش
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      <Modal opened={editing !== null} onClose={() => setEditing(null)} title="ویرایش کاتالوگ" centered>
        {editing ? (
          <Stack gap="sm">
            <TextInput
              label="نام نمایشی"
              required
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
            />
            <TextInput
              label="لوگو"
              description="png/jpg/webp/svg — حداکثر ۲ مگابایت"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
            />
            {editing.logoPath && !file ? (
              <Group gap="sm">
                <Text size="xs" c="dimmed">
                  لوگوی فعلی:
                </Text>
                <Image
                  src={`/api/catalog/logo/${apiBase.split('/').pop()}/${editing.id}`}
                  alt={editing.label}
                  w={32}
                  h={32}
                  fit="contain"
                  style={{ background: '#fff' }}
                />
              </Group>
            ) : null}
            <Group justify="end" mt="sm">
              <Button variant="subtle" onClick={() => setEditing(null)}>
                انصراف
              </Button>
              <Button loading={saving} onClick={saveEdit}>
                ذخیره
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}
