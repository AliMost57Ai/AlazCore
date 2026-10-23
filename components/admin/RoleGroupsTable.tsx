'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconFolders, IconPlus, IconTrash } from '@tabler/icons-react';
import { ActionIcon, Button, Group, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import ListFilterForm from '@/components/ui/panel/ListFilterForm';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import ResponsiveModal from '@/components/ui/panel/ResponsiveModal';
import { enNumber } from '@/lib/format';
import type { RoleGroupDTO } from '@/lib/roles';

/** The create/edit form values. */
interface GroupFormValues {
  name: string;
  description: string;
}

const EMPTY_FORM: GroupFormValues = { name: '', description: '' };

export interface RoleGroupsTableProps {
  groups: RoleGroupDTO[];
}

/**
 * The admin role-group manager (/role-groups): display-only buckets that
 * organise roles (e.g. «تیم فروش», «انبار»). Deleting a group just ungroups
 * its roles — nothing else changes.
 */
export default function RoleGroupsTable({ groups }: RoleGroupsTableProps) {
  const router = useRouter();
  const [modalOpened, setModalOpened] = useState(false);
  const [editing, setEditing] = useState<RoleGroupDTO | null>(null);
  const [form, setForm] = useState<GroupFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<RoleGroupDTO | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpened(true);
  }

  function openEdit(group: RoleGroupDTO) {
    setEditing(group);
    setForm({ name: group.name, description: group.description });
    setFormError(null);
    setModalOpened(true);
  }

  function validateForm(): string | null {
    if (form.name.trim().length < 2 || form.name.trim().length > 64) {
      return 'نام گروه باید ۲ تا ۶۴ نویسه باشد.';
    }
    if (form.description.trim().length > 200) {
      return 'توضیح گروه نمی‌تواند بیشتر از ۲۰۰ نویسه باشد.';
    }
    return null;
  }

  async function handleSubmit() {
    const validation = validateForm();
    if (validation) {
      setFormError(validation);
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const response = await fetch(
        editing ? `/api/admin/role-groups/${editing.id}` : '/api/admin/role-groups',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim(),
          }),
        }
      );

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setFormError(payload.error ?? 'ذخیره گروه ناموفق بود.');
        return;
      }

      notifications.show({
        title: editing ? 'گروه ویرایش شد' : 'گروه ساخته شد',
        message: form.name.trim(),
        color: 'green',
        icon: <IconFolders size={16} />,
      });
      setModalOpened(false);
      router.refresh();
    } catch {
      setFormError('ارتباط با سرور برقرار نشد.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/role-groups/${deleting.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        notifications.show({
          title: 'حذف ناموفق بود',
          message: payload.error ?? 'لطفاً دوباره تلاش کنید.',
          color: 'red',
        });
        return;
      }
      notifications.show({
        title: 'گروه حذف شد',
        message: deleting.name,
        color: 'green',
        icon: <IconTrash size={16} />,
      });
      setDeleting(null);
      router.refresh();
    } catch {
      notifications.show({
        title: 'ارتباط برقرار نشد',
        message: 'اتصال خود را بررسی کنید.',
        color: 'red',
      });
    }
  }

  const columns: PanelColumn<RoleGroupDTO>[] = [
    {
      key: 'name',
      header: 'نام گروه',
      cardTitle: true,
      card: (group) => group.name,
      cell: (group) => (
        <Text size="sm" fw={500}>
          {group.name}
        </Text>
      ),
    },
    {
      key: 'description',
      header: 'توضیح',
      cell: (group) => (
        <Text size="sm" c={group.description ? undefined : 'dimmed'}>
          {group.description || '—'}
        </Text>
      ),
    },
    {
      key: 'roles',
      header: 'نقش‌ها',
      cardHead: true,
      cell: (group) => (
        <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {enNumber(group.roleCount)}
        </Text>
      ),
    },
  ];

  return (
    <>
      <ListFilterForm
        action="/role-groups"
        actions={
          <Button size="sm" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            گروه جدید
          </Button>
        }
      >
        {null}
      </ListFilterForm>

      <PanelList<RoleGroupDTO>
        rows={groups}
        columns={columns}
        getRowId={(group) => group.id}
        renderActions={(group) => (
          <Group gap="xs" wrap="nowrap">
            <Button variant="light" size="compact-xs" onClick={() => openEdit(group)}>
              ویرایش
            </Button>
            <ActionIcon
              color="red"
              variant="subtle"
              aria-label={`حذف ${group.name}`}
              onClick={() => setDeleting(group)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        )}
        empty={{
          icon: IconFolders,
          message: 'هنوز گروهی ثبت نشده است.',
          hint: 'گروه‌ها فقط برای دسته‌بندی نمایش نقش‌ها هستند.',
        }}
      />

      <Text size="xs" c="dimmed" mt="sm">
        حذف یک گروه، نقش‌های داخلش را حذف نمی‌کند — فقط بی‌گروه می‌شوند.
      </Text>

      {/* Create / edit — the same modal for both. */}
      <ResponsiveModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editing ? `ویرایش ${editing.name}` : 'گروه نقش جدید'}
      >
        <Stack gap="sm">
          <TextInput
            label="نام گروه"
            placeholder="مثلاً تیم فروش"
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
          />
          <Textarea
            label="توضیح"
            description="اختیاری — حداکثر ۲۰۰ نویسه."
            autosize
            minRows={2}
            maxRows={4}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.currentTarget.value })}
          />
          {formError ? (
            <Text size="sm" c="red">
              {formError}
            </Text>
          ) : null}
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={() => setModalOpened(false)}>
              انصراف
            </Button>
            <Button loading={saving} onClick={handleSubmit}>
              {editing ? 'ذخیره تغییرات' : 'ساخت گروه'}
            </Button>
          </Group>
        </Stack>
      </ResponsiveModal>

      {/* Delete confirmation — never window.confirm (project convention). */}
      <ResponsiveModal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف گروه نقش"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            گروه{' '}
            <Text component="span" fw={700}>
              {deleting?.name}
            </Text>{' '}
            حذف شود؟ نقش‌های این گروه حذف نمی‌شوند؛ فقط بی‌گروه می‌شوند.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleting(null)}>
              انصراف
            </Button>
            <Button color="red" onClick={handleDelete}>
              حذف
            </Button>
          </Group>
        </Stack>
      </ResponsiveModal>
    </>
  );
}
