'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconAlertTriangle,
  IconBan,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUser,
  IconUserCheck,
} from '@tabler/icons-react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Group,
  List,
  Loader,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { faCurrency, faJalaliDate, faNumber } from '@/lib/format';
import type { RoleDTO } from '@/lib/roles';
import type { AdminUserDTO, UserActivity } from '@/lib/users-admin';

/** The create/edit form values. */
interface UserFormValues {
  name: string;
  email: string;
  phone: string;
  role: string;
  password: string;
}

const EMPTY_FORM: UserFormValues = { name: '', email: '', phone: '', role: 'member', password: '' };

export interface UsersTableProps {
  users: AdminUserDTO[];
  /** The selectable roles (machine name ↔ Persian title). */
  roles: RoleDTO[];
  /** The signed-in admin's user id — self-delete is blocked server-side too. */
  currentUserId: string;
}

/**
 * The staff user manager (/users): personnel accounts only — customers live on
 * /customers. Create/edit (name, identifiers, role, optional password reset),
 * delete — only for accounts with no recorded activity — and enable/disable for
 * the rest. Everything goes through /api/admin/users; this component just
 * refreshes the server data afterwards.
 */
export default function UsersTable({ users, roles, currentUserId }: UsersTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [modalOpened, setModalOpened] = useState(false);
  const [editing, setEditing] = useState<AdminUserDTO | null>(null);
  const [form, setForm] = useState<UserFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminUserDTO | null>(null);
  /** Null while loading — the delete dialog asks before it offers a button. */
  const [deletingActivity, setDeletingActivity] = useState<UserActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const roleByname = useMemo(() => new Map(roles.map((role) => [role.name, role])), [roles]);
  // The customer role never appears here — customers are managed on /customers.
  const roleOptions = roles
    .filter((role) => role.name !== 'customer')
    .map((role) => ({
      value: role.name,
      label: `${role.title}${role.isAdmin ? ' — دسترسی مدیر' : ''}`,
    }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return users;
    }
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(q) ||
        (user.email ?? '').toLowerCase().includes(q) ||
        (user.phone ?? '').includes(q)
    );
  }, [users, search]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpened(true);
  }

  function openEdit(user: AdminUserDTO) {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email ?? '',
      phone: user.phone ?? '',
      role: user.role,
      password: '',
    });
    setFormError(null);
    setModalOpened(true);
  }

  /** Validates locally, then POSTs/PATCHes — the API re-validates everything. */
  function validateForm(): string | null {
    if (form.name.trim().length < 2) {
      return 'نام باید حداقل ۲ نویسه باشد.';
    }
    if (form.email.trim() === '' && form.phone.trim() === '') {
      return 'ایمیل یا شماره موبایل لازم است — کاربر باید بتواند وارد شود.';
    }
    if (form.phone.trim() !== '' && !/^09\d{9}$/.test(form.phone.replace(/[^\d]/g, ''))) {
      return 'شماره موبایل باید با ۰۹ شروع شود و دقیقاً ۱۱ رقم باشد.';
    }
    if (form.role === '') {
      return 'نقش کاربر را انتخاب کنید.';
    }
    if (!editing && form.password.length < 8) {
      return 'گذرواژه باید حداقل ۸ نویسه باشد.';
    }
    if (editing && form.password !== '' && form.password.length < 8) {
      return 'گذرواژه جدید باید حداقل ۸ نویسه باشد — یا خالی بگذارید تا تغییری نکند.';
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
        editing ? `/api/admin/users/${editing.id}` : '/api/admin/users',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim() === '' ? null : form.email.trim(),
            phone: form.phone.trim() === '' ? null : form.phone.trim(),
            role: form.role,
            password: form.password === '' ? null : form.password,
          }),
        }
      );

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setFormError(payload.error ?? 'ذخیره کاربر ناموفق بود.');
        return;
      }

      notifications.show({
        title: editing ? 'کاربر ویرایش شد' : 'کاربر ساخته شد',
        message: form.name.trim(),
        color: 'green',
        icon: <IconUser size={16} />,
      });
      setModalOpened(false);
      router.refresh();
    } catch {
      setFormError('ارتباط با سرور برقرار نشد.');
    } finally {
      setSaving(false);
    }
  }

  /**
   * Opens the delete dialog and asks the server for this account's activity
   * first — the rule is "delete only with no activity", so the dialog must know
   * the answer before it can offer the right button.
   */
  async function openDelete(user: AdminUserDTO) {
    setDeleting(user);
    setDeletingActivity(null);
    setActivityLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`);
      if (response.ok) {
        const payload = (await response.json()) as { activity?: UserActivity };
        setDeletingActivity(payload.activity ?? { lines: [], total: 0 });
      } else {
        // Fail closed: without the count we cannot offer a delete.
        setDeletingActivity({ lines: [], total: -1 });
      }
    } catch {
      setDeletingActivity({ lines: [], total: -1 });
    } finally {
      setActivityLoading(false);
    }
  }

  /** Blocks/unblocks one account — sign-in is refused while blocked. */
  async function handleToggleBlock(user: AdminUserDTO) {
    setBusyId(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: !user.isBlocked }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        notifications.show({
          title: 'تغییر وضعیت ناموفق بود',
          message: payload.error ?? 'لطفاً دوباره تلاش کنید.',
          color: 'red',
        });
        return;
      }
      notifications.show({
        title: user.isBlocked ? 'حساب فعال شد' : 'حساب غیرفعال شد',
        message: user.isBlocked
          ? `${user.name} دوباره می‌تواند وارد شود.`
          : `${user.name} تا فعال‌سازی دوباره نمی‌تواند وارد شود.`,
        color: 'green',
        icon: user.isBlocked ? <IconUserCheck size={16} /> : <IconBan size={16} />,
      });
      setDeleting(null);
      router.refresh();
    } catch {
      notifications.show({
        title: 'ارتباط برقرار نشد',
        message: 'اتصال خود را بررسی کنید.',
        color: 'red',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!deleting) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${deleting.id}`, { method: 'DELETE' });
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
        title: 'کاربر حذف شد',
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

  function roleBadge(user: AdminUserDTO) {
    const role = roleByname.get(user.role);
    return (
      <Badge variant="light" color={role?.isAdmin ? 'red' : 'blue'} radius="sm" size="sm">
        {role?.title ?? user.role}
      </Badge>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <TextInput
          size="sm"
          w={{ base: '100%', sm: 280 }}
          placeholder="جستجو: نام، ایمیل، شماره موبایل…"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <Button size="sm" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          کاربر جدید
        </Button>
      </Group>

      {users.length === 0 ? (
        <Card withBorder padding="lg">
          <Stack gap={6} align="center" py="xl">
            <IconUser size={36} stroke={1.2} />
            <Text size="sm" c="dimmed">
              هنوز کاربری ثبت نشده است.
            </Text>
          </Stack>
        </Card>
      ) : (
        <Table.ScrollContainer minWidth={960}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>نام</Table.Th>
                <Table.Th>شناسه ورود</Table.Th>
                <Table.Th>نقش</Table.Th>
                <Table.Th>وضعیت</Table.Th>
                <Table.Th>کیف پول</Table.Th>
                <Table.Th>عضویت</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td fw={500}>
                    {user.name}
                    {user.id === currentUserId ? (
                      <Text component="span" size="xs" c="dimmed">
                        {' '}
                        (شما)
                      </Text>
                    ) : null}
                  </Table.Td>
                  <Table.Td dir="ltr" style={{ textAlign: 'right' }}>
                    <Text size="sm" ff="monospace">
                      {user.email ?? user.phone ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>{roleBadge(user)}</Table.Td>
                  <Table.Td>
                    <Badge
                      variant="light"
                      color={user.isBlocked ? 'red' : 'teal'}
                      radius="sm"
                      size="sm"
                    >
                      {user.isBlocked ? 'غیرفعال' : 'فعال'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{faCurrency(user.walletBalance, false)}</Table.Td>
                  <Table.Td c="dimmed">{faJalaliDate(new Date(user.createdAt))}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Button variant="light" size="compact-xs" onClick={() => openEdit(user)}>
                        ویرایش
                      </Button>
                      <ActionIcon
                        color={user.isBlocked ? 'teal' : 'orange'}
                        variant="subtle"
                        aria-label={
                          user.isBlocked ? `فعال‌سازی ${user.name}` : `غیرفعال‌سازی ${user.name}`
                        }
                        loading={busyId === user.id}
                        disabled={user.id === currentUserId}
                        onClick={() => void handleToggleBlock(user)}
                      >
                        {user.isBlocked ? <IconUserCheck size={16} /> : <IconBan size={16} />}
                      </ActionIcon>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        aria-label={`حذف ${user.name}`}
                        disabled={user.id === currentUserId}
                        onClick={() => void openDelete(user)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {filtered.length === 0 && users.length > 0 ? (
        <Text size="sm" c="dimmed" mt="sm">
          کاربری مطابق جستجو یافت نشد.
        </Text>
      ) : null}

      {/* Create / edit — the same modal for both. */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editing ? `ویرایش ${editing.name}` : 'کاربر جدید'}
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="نام"
            placeholder="مثلاً سارا کریمی"
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
          />
          <Group gap="sm" grow>
            <TextInput
              label="ایمیل (ورود کارمندان)"
              placeholder="user@example.com"
              dir="ltr"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.currentTarget.value })}
            />
            <TextInput
              label="شماره موبایل (اختیاری)"
              placeholder="۰۹۱۲۱۲۳۴۵۶۷"
              dir="ltr"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.currentTarget.value })}
            />
          </Group>
          <Text size="xs" c="dimmed">
            یکی از دو فیلد بالا کافی است — کارمندان معمولاً با ایمیل وارد می‌شوند.
          </Text>
          <Select
            label="نقش"
            description="نقش‌های دارای دسترسی مدیر به همه بخش‌ها می‌رسند؛ سایر نقش‌ها فقط به منوهای داده‌شده در صفحه نقش‌ها."
            data={roleOptions}
            searchable
            value={form.role}
            onChange={(value) => setForm({ ...form, role: value ?? 'member' })}
          />
          <PasswordInput
            label={editing ? 'گذرواژه جدید (اختیاری)' : 'گذرواژه'}
            description={editing ? 'خالی بگذارید تا گذرواژه فعلی حفظ شود.' : undefined}
            placeholder="حداقل ۸ نویسه"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.currentTarget.value })}
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
              {editing ? 'ذخیره تغییرات' : 'ساخت کاربر'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/*
        Delete / deactivate. An account with recorded activity (orders, wallet
        ledger, tickets, …) is never deleted — those rows would lose their owner
        — so the dialog offers «غیرفعال کردن» instead. Never window.confirm
        (project convention).
      */}
      <Modal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف کاربر"
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            کاربر{' '}
            <Text component="span" fw={700}>
              {deleting?.name}
            </Text>{' '}
            حذف شود؟
          </Text>

          {activityLoading ? (
            <Center py="md">
              <Loader size="sm" />
            </Center>
          ) : deletingActivity && deletingActivity.total > 0 ? (
            <>
              <Alert
                color="orange"
                icon={<IconAlertTriangle size={18} />}
                title="این کاربر فعالیت ثبت‌شده دارد"
              >
                <Stack gap="xs">
                  <Text size="sm">
                    {faNumber(deletingActivity.total)} مورد فعالیت برای این کاربر ثبت شده است و به
                    همین دلیل حذف نمی‌شود؛ فقط می‌توانید حسابش را غیرفعال کنید.
                  </Text>
                  <List size="xs" spacing={2}>
                    {deletingActivity.lines.map((line) => (
                      <List.Item key={line.label}>
                        {line.label}: {faNumber(line.count)}
                      </List.Item>
                    ))}
                  </List>
                </Stack>
              </Alert>
              <Text size="xs" c="dimmed">
                کاربر غیرفعال نمی‌تواند وارد شود، اما سابقه‌اش دست‌نخورده می‌ماند و هر زمان
                می‌توانید فعالش کنید.
              </Text>
              <Group justify="flex-end">
                <Button variant="subtle" onClick={() => setDeleting(null)}>
                  انصراف
                </Button>
                <Button
                  color="orange"
                  leftSection={<IconBan size={16} />}
                  loading={busyId === deleting?.id}
                  onClick={() => deleting && void handleToggleBlock(deleting)}
                >
                  غیرفعال کردن
                </Button>
              </Group>
            </>
          ) : deletingActivity && deletingActivity.total < 0 ? (
            <>
              <Alert color="red" icon={<IconAlertTriangle size={18} />}>
                <Text size="sm">
                  بررسی فعالیت‌های این کاربر ناموفق بود؛ برای جلوگیری از حذف ناخواسته، حذف انجام
                  نشد. صفحه را دوباره باز کنید.
                </Text>
              </Alert>
              <Group justify="flex-end">
                <Button variant="subtle" onClick={() => setDeleting(null)}>
                  بستن
                </Button>
              </Group>
            </>
          ) : (
            <>
              <Text size="sm" c="dimmed">
                این کاربر هیچ فعالیتی در سایت ثبت نکرده است، پس حذفش بی‌خطر است.
              </Text>
              <Group justify="flex-end">
                <Button variant="subtle" onClick={() => setDeleting(null)}>
                  انصراف
                </Button>
                <Button color="red" onClick={handleDelete}>
                  حذف
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
