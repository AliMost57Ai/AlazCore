'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconIdBadge2, IconPlus, IconShieldLock, IconTrash } from '@tabler/icons-react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import ListFilterForm from '@/components/ui/panel/ListFilterForm';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import ResponsiveModal from '@/components/ui/panel/ResponsiveModal';
import { enNumber } from '@/lib/format';
import { ASSIGNABLE_MENUS, type CapabilityGrant, type MenuAction } from '@/lib/nav-permissions';
import type { RoleDTO } from '@/lib/roles';

/** The create/edit form values. */
interface RoleFormValues {
  name: string;
  title: string;
  isAdmin: boolean;
  /** Granted permission entries — ignored while isAdmin is on. */
  permissions: string[];
}

const EMPTY_FORM: RoleFormValues = {
  name: '',
  title: '',
  isAdmin: false,
  permissions: [],
};

/** href → Persian label, for the table's access column. */
const HREF_LABELS = new Map(
  ASSIGNABLE_MENUS.flatMap((group) => group.items.map((item) => [item.href, item.label]))
);

/** The permission entry a (href, action) pair stores — bare href for view. */
function entryFor(href: string, action: MenuAction): string {
  return action === 'view' ? href : `${href}:${action}`;
}

function hasAction(perms: string[], href: string, action: MenuAction): boolean {
  if (perms.includes('*')) {
    return true;
  }
  return perms.includes(entryFor(href, action));
}

/**
 * Toggles one action. Checking اصلاح/افزودن also grants مشاهده (the write
 * actions need the page visible); unchecking مشاهده drops the whole page.
 */
function toggleAction(perms: string[], href: string, action: MenuAction): string[] {
  const entry = entryFor(href, action);
  if (perms.includes(entry)) {
    if (action === 'view') {
      // The page goes away entirely — its write actions are meaningless alone.
      return perms.filter((item) => item !== href && !item.startsWith(`${href}:`));
    }
    return perms.filter((item) => item !== entry);
  }
  if (action === 'view') {
    return [...perms, href];
  }
  const next = perms.includes(href) ? perms : [...perms, href];
  return [...next, entry];
}

/** One page's grants as a readable cell: «محصولات (اصلاح)». */
function describeEntry(perms: string[], href: string, labels: Map<string, string>): string | null {
  const label = labels.get(href) ?? href;
  if (!hasAction(perms, href, 'view')) {
    return null;
  }
  const actions: string[] = [];
  if (hasAction(perms, href, 'edit')) {
    actions.push('اصلاح');
  }
  if (hasAction(perms, href, 'add')) {
    actions.push('افزودن');
  }
  // Both write actions = the full page; neither = view-only. Only the
  // in-between cases need a marker.
  if (actions.length === 0 || actions.length === 2) {
    return label;
  }
  return `${label} (${actions[0]})`;
}

/** The whole grant list as one readable line — the cell text and its tooltip. */
function describePermissions(perms: string[], labels: Map<string, string>): string {
  return [...new Set(perms.map((entry) => entry.replace(/:(edit|add|view)$/, '')))]
    .map((href) => describeEntry(perms, href, labels))
    .filter((part): part is string => part !== null)
    .join('، ');
}

export interface RolesTableProps {
  roles: RoleDTO[];
  /** Feature-switch grants visible to this site — filtered by the license. */
  capabilities: CapabilityGrant[];
}

/**
 * The admin role manager (/roles): machine name + Persian title + the
 * دسترسی مدیر flag (full admin access), with a live user count per role.
 * Non-admin roles get per-page action grants — مشاهده / اصلاح / افزودن —
 * so e.g. a role can see the products page without its add/edit buttons.
 * Built-ins can be retitled but not deleted; roles still held by users can't
 * be deleted either — the API blocks both.
 */
export default function RolesTable({ roles, capabilities }: RolesTableProps) {
  const router = useRouter();
  const [modalOpened, setModalOpened] = useState(false);
  const [editing, setEditing] = useState<RoleDTO | null>(null);
  const [form, setForm] = useState<RoleFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<RoleDTO | null>(null);

  // Grant labels for the access column — menu hrefs plus capability entries.
  const labels = useMemo(() => {
    const map = new Map(HREF_LABELS);
    for (const capability of capabilities) {
      map.set(capability.entry, capability.label);
    }
    return map;
  }, [capabilities]);

  /** Toggles one capability entry — independent of menu grants. */
  function toggleCapability(entry: string): string[] {
    return form.permissions.includes(entry)
      ? form.permissions.filter((item) => item !== entry)
      : [...form.permissions, entry];
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpened(true);
  }

  function openEdit(role: RoleDTO) {
    setEditing(role);
    setForm({
      name: role.name,
      title: role.title,
      isAdmin: role.isAdmin,
      permissions: role.permissions,
    });
    setFormError(null);
    setModalOpened(true);
  }

  function validateForm(): string | null {
    if (!/^[a-z][a-z0-9_-]{1,31}$/.test(form.name.trim())) {
      return 'نام نقش باید با حرف لاتین کوچک شروع شود و ۲ تا ۳۲ نویسه لاتین/عدد باشد.';
    }
    if (form.title.trim().length < 2 || form.title.trim().length > 64) {
      return 'عنوان نقش باید ۲ تا ۶۴ نویسه باشد.';
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
        editing ? `/api/admin/roles/${editing.id}` : '/api/admin/roles',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            title: form.title.trim(),
            isAdmin: form.isAdmin,
            permissions: form.isAdmin ? [] : form.permissions,
          }),
        }
      );

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setFormError(payload.error ?? 'ذخیره نقش ناموفق بود.');
        return;
      }

      notifications.show({
        title: editing ? 'نقش ویرایش شد' : 'نقش ساخته شد',
        message: form.title.trim(),
        color: 'green',
        icon: <IconIdBadge2 size={16} />,
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
      const response = await fetch(`/api/admin/roles/${deleting.id}`, { method: 'DELETE' });
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
        title: 'نقش حذف شد',
        message: deleting.title,
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

  const columns: PanelColumn<RoleDTO>[] = [
    {
      key: 'title',
      header: 'عنوان',
      cardTitle: true,
      card: (role) => (role.isBuiltIn ? `${role.title} (پیش‌فرض)` : role.title),
      cell: (role) => (
        <Text size="sm" fw={500}>
          {role.title}
          {role.isBuiltIn ? (
            <Text component="span" size="xs" c="dimmed">
              {' '}
              (پیش‌فرض)
            </Text>
          ) : null}
        </Text>
      ),
    },
    {
      key: 'name',
      header: 'نام سیستمی',
      cell: (role) => (
        <Text size="sm" ff="monospace" dir="ltr" ta="start">
          {role.name}
        </Text>
      ),
    },
    {
      key: 'access',
      header: 'دسترسی منوها',
      cardHead: true,
      cell: (role) => {
        if (role.isAdmin) {
          return (
            <Badge
              variant="light"
              color="red"
              radius="sm"
              size="sm"
              leftSection={<IconShieldLock size={12} />}
            >
              دسترسی کامل
            </Badge>
          );
        }
        if (role.permissions.length === 0) {
          return (
            <Text size="sm" c="dimmed">
              —
            </Text>
          );
        }
        return (
          <Text
            size="xs"
            c="dimmed"
            lineClamp={1}
            maw={260}
            title={describePermissions(role.permissions, labels)}
          >
            {describePermissions(role.permissions, labels)}
          </Text>
        );
      },
    },
    {
      key: 'users',
      header: 'کاربران',
      cell: (role) => (
        <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {enNumber(role.userCount)}
        </Text>
      ),
    },
  ];

  return (
    <>
      <ListFilterForm
        action="/roles"
        actions={
          <Button size="sm" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            نقش جدید
          </Button>
        }
      >
        {null}
      </ListFilterForm>

      <PanelList<RoleDTO>
        rows={roles}
        columns={columns}
        getRowId={(role) => role.id}
        renderActions={(role) => (
          <Group gap="xs" wrap="nowrap">
            <Button variant="light" size="compact-xs" onClick={() => openEdit(role)}>
              ویرایش
            </Button>
            <ActionIcon
              color="red"
              variant="subtle"
              aria-label={`حذف ${role.title}`}
              disabled={role.isBuiltIn || role.userCount > 0}
              onClick={() => setDeleting(role)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        )}
        empty={{
          icon: IconIdBadge2,
          message: 'هنوز نقشی ثبت نشده است.',
          hint: 'نقش‌های پیش‌فرض (admin، member، customer) از ابتدا موجودند.',
        }}
      />

      <Text size="xs" c="dimmed" mt="sm">
        نقش‌های پیش‌فرض (admin، member، customer) قابل حذف نیستند؛ نقشی هم که روی کاربری تنظیم باشد
        ابتدا باید از کاربرانش گرفته شود. تغییر «نام سیستمی»، کاربران آن نقش را هم به‌روز می‌کند.
      </Text>

      {/* Create / edit — the same modal for both. */}
      <ResponsiveModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editing ? `ویرایش ${editing.title}` : 'نقش جدید'}
        size="lg"
      >
        <Stack gap="sm">
          <TextInput
            label="عنوان نقش"
            description="نام فارسی که در فهرست کاربران دیده می‌شود."
            placeholder="مثلاً پشتیبان فروش"
            required
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.currentTarget.value })}
          />
          <TextInput
            label="نام سیستمی"
            description="لاتینِ کوچک — روی حساب هر کاربر ذخیره می‌شود."
            placeholder="مثلاً sales_support"
            dir="ltr"
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
          />
          <Switch
            label="دسترسی مدیر"
            description="کاربران این نقش به همه بخش‌های مدیریتی دسترسی پیدا می‌کنند."
            checked={form.isAdmin}
            onChange={(event) => setForm({ ...form, isAdmin: event.currentTarget.checked })}
          />
          {form.isAdmin ? (
            <Text size="xs" c="dimmed">
              نقش‌های دارای دسترسی مدیر به همه منوها می‌رسند — انتخاب دسترسی لازم نیست.
            </Text>
          ) : (
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                دسترسی به منوها
              </Text>
              <Text size="xs" c="dimmed">
                برای هر صفحه مشخص کنید کاربر فقط آن را ببیند یا بتواند در آن ویرایش و افزودن هم
                انجام دهد؛ داشبورد و تنظیمات شخصی همیشه در دسترس است.
              </Text>
              {ASSIGNABLE_MENUS.map((group) => (
                <Card withBorder padding="xs" key={group.id}>
                  <Text size="xs" fw={700} c="dimmed" mb={6}>
                    {group.label}
                  </Text>
                  <Table verticalSpacing={4} horizontalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>صفحه</Table.Th>
                        <Table.Th w={70}>مشاهده</Table.Th>
                        <Table.Th w={70}>اصلاح</Table.Th>
                        <Table.Th w={70}>افزودن</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {group.items.map((item) => (
                        <Table.Tr key={item.href}>
                          <Table.Td>
                            <Text size="xs" fw={500}>
                              {item.label}
                            </Text>
                          </Table.Td>
                          {(['view', 'edit', 'add'] as MenuAction[]).map((action) => (
                            <Table.Td key={action}>
                              <Checkbox
                                size="xs"
                                aria-label={`${item.label} — ${action}`}
                                checked={hasAction(form.permissions, item.href, action)}
                                onChange={() =>
                                  setForm({
                                    ...form,
                                    permissions: toggleAction(form.permissions, item.href, action),
                                  })
                                }
                              />
                            </Table.Td>
                          ))}
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Card>
              ))}
              {capabilities.length > 0 ? (
                <Card withBorder padding="xs">
                  <Text size="xs" fw={700} c="dimmed" mb={6}>
                    توانایی‌های ویژه
                  </Text>
                  <Stack gap={6}>
                    {capabilities.map((capability) => (
                      <Checkbox
                        key={capability.entry}
                        size="xs"
                        label={
                          <Text size="xs" fw={500}>
                            {capability.label}
                            <Text component="span" size="xs" c="dimmed">
                              {' '}
                              — {capability.description}
                            </Text>
                          </Text>
                        }
                        checked={form.permissions.includes(capability.entry)}
                        onChange={() =>
                          setForm({ ...form, permissions: toggleCapability(capability.entry) })
                        }
                      />
                    ))}
                  </Stack>
                </Card>
              ) : null}
            </Stack>
          )}
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
              {editing ? 'ذخیره تغییرات' : 'ساخت نقش'}
            </Button>
          </Group>
        </Stack>
      </ResponsiveModal>

      {/* Delete confirmation — never window.confirm (project convention). */}
      <ResponsiveModal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف نقش"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            نقش{' '}
            <Text component="span" fw={700}>
              {deleting?.title}
            </Text>{' '}
            حذف شود؟ این نقش روی هیچ کاربری تنظیم نیست و قابل بازگشت نیست.
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
