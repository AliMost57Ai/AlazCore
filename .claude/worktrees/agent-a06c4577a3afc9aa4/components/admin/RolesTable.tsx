'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconIdBadge2, IconPlus, IconShieldLock, IconTrash } from '@tabler/icons-react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { faNumber } from '@/lib/format';
import { ASSIGNABLE_MENUS, type MenuAction } from '@/lib/nav-permissions';
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
function describeEntry(perms: string[], href: string): string | null {
  const label = HREF_LABELS.get(href) ?? href;
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
function describePermissions(perms: string[]): string {
  return [...new Set(perms.map((entry) => entry.replace(/:(edit|add|view)$/, '')))]
    .map((href) => describeEntry(perms, href))
    .filter((part): part is string => part !== null)
    .join('، ');
}

export interface RolesTableProps {
  roles: RoleDTO[];
}

/**
 * The admin role manager (/roles): machine name + Persian title + the
 * دسترسی مدیر flag (full admin access) + the granted menus, with a live user
 * count per role. Built-ins can be retitled but not deleted; roles still held
 * by users can't be deleted either — the API blocks both, and the trash icon
 * says why rather than going quietly dead.
 */
export default function RolesTable({ roles }: RolesTableProps) {
  const router = useRouter();
  const [modalOpened, setModalOpened] = useState(false);
  const [editing, setEditing] = useState<RoleDTO | null>(null);
  const [form, setForm] = useState<RoleFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<RoleDTO | null>(null);

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

  /** Why this role cannot be deleted, or null when it can. */
  function deleteBlockReason(role: RoleDTO): string | null {
    if (role.isBuiltIn) {
      return 'نقش‌های پیش‌فرض (admin، member، customer، support) توسط خود برنامه استفاده می‌شوند و حذف نمی‌شوند.';
    }
    if (role.userCount > 0) {
      return `این نقش روی ${faNumber(role.userCount)} کاربر تنظیم است — ابتدا نقش آن کاربران را در صفحه «کاربران» عوض کنید.`;
    }
    return null;
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

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button size="sm" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          نقش جدید
        </Button>
      </Group>

      {roles.length === 0 ? (
        <Card withBorder padding="lg">
          <Stack gap={6} align="center" py="xl">
            <IconIdBadge2 size={36} stroke={1.2} />
            <Text size="sm" c="dimmed">
              هنوز نقشی ثبت نشده است.
            </Text>
          </Stack>
        </Card>
      ) : (
        <Table.ScrollContainer minWidth={760}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>عنوان</Table.Th>
                <Table.Th>نام سیستمی</Table.Th>
                <Table.Th>دسترسی منوها</Table.Th>
                <Table.Th>کاربران</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {roles.map((role) => (
                <Table.Tr key={role.id}>
                  <Table.Td fw={500}>
                    {role.title}
                    {role.isBuiltIn ? (
                      <Text component="span" size="xs" c="dimmed">
                        {' '}
                        (پیش‌فرض)
                      </Text>
                    ) : null}
                  </Table.Td>
                  <Table.Td dir="ltr" style={{ textAlign: 'right' }}>
                    <Text size="sm" ff="monospace">
                      {role.name}
                    </Text>
                  </Table.Td>
                  <Table.Td maw={260}>
                    {role.isAdmin ? (
                      <Badge
                        variant="light"
                        color="red"
                        radius="sm"
                        size="sm"
                        leftSection={<IconShieldLock size={12} />}
                      >
                        دسترسی کامل
                      </Badge>
                    ) : role.permissions.length === 0 ? (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    ) : (
                      <Text
                        size="xs"
                        c="dimmed"
                        lineClamp={1}
                        title={describePermissions(role.permissions)}
                      >
                        {describePermissions(role.permissions)}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{faNumber(role.userCount)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Button variant="light" size="compact-xs" onClick={() => openEdit(role)}>
                        ویرایش
                      </Button>
                      {/*
                        A disabled ActionIcon gives the admin no hint about why
                        the trash is dead, which reads as a broken button. The
                        Tooltip carries the rule instead, and it wraps the
                        ActionIcon's own Box so it still fires while disabled.
                      */}
                      <Tooltip
                        label={deleteBlockReason(role) ?? 'حذف نقش'}
                        withArrow
                        multiline
                        w={260}
                        disabled={deleteBlockReason(role) === null}
                      >
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          aria-label={`حذف ${role.title}`}
                          disabled={deleteBlockReason(role) !== null}
                          onClick={() => setDeleting(role)}
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
        </Table.ScrollContainer>
      )}

      <Text size="xs" c="dimmed" mt="sm">
        نقش‌های پیش‌فرض (admin، member، customer، support) قابل حذف نیستند؛ نقشی هم که روی کاربری
        تنظیم باشد ابتدا باید از کاربرانش گرفته شود. تغییر «نام سیستمی»، کاربران آن نقش را هم به‌روز
        می‌کند.
      </Text>

      {/* Create / edit — the same modal for both. */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editing ? `ویرایش ${editing.title}` : 'نقش جدید'}
        centered
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
      </Modal>

      {/* Delete confirmation — never window.confirm (project convention). */}
      <Modal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف نقش"
        centered
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
      </Modal>
    </>
  );
}
