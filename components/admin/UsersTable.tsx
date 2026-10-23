'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconPlus, IconSearch, IconTrash, IconUser } from '@tabler/icons-react';
import { ActionIcon, Badge, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import ListFilterForm from '@/components/ui/panel/ListFilterForm';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import ResponsiveModal from '@/components/ui/panel/ResponsiveModal';
import { enCurrency, faJalaliDate } from '@/lib/format';
import type { RoleDTO } from '@/lib/roles';
import type { AdminUserDTO } from '@/lib/users-admin';

export interface UsersTableProps {
  users: AdminUserDTO[];
  /** The selectable roles (machine name ↔ Persian title). */
  roles: RoleDTO[];
  /** The signed-in admin's user id — self-delete is blocked server-side too. */
  currentUserId: string;
  /** عبارت جستجوی GET (نام/ایمیل/موبایل) — فیلتر در همین کامپوننت اعمال می‌شود. */
  search?: string;
}

/**
 * The staff user manager (/users): personnel accounts only — customers live on
 * /customers. Create/edit live on their own dedicated pages (/users/new و
 * /users/[id]/edit) — فرم‌های بیش از ۴ فیلد مودال باز نمی‌شوند؛ حذف از همین
 * لیست است و همه نوشته‌ها از /api/admin/users می‌گذرد. لیست روی قاعده مشترک
 * PanelList است — فیلتر GET در ردیف فیلتر واحد.
 */
export default function UsersTable({ users, roles, currentUserId, search = '' }: UsersTableProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<AdminUserDTO | null>(null);

  const roleByname = useMemo(() => new Map(roles.map((role) => [role.name, role])), [roles]);

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

  const roleBadge = (user: AdminUserDTO) => {
    const role = roleByname.get(user.role);
    return (
      <Badge variant="light" color={role?.isAdmin ? 'red' : 'blue'} radius="sm" size="sm">
        {role?.title ?? user.role}
      </Badge>
    );
  };

  const columns: PanelColumn<AdminUserDTO>[] = [
    {
      key: 'name',
      header: 'نام',
      cardTitle: true,
      card: (user) => (user.id === currentUserId ? `${user.name} (شما)` : user.name),
      cell: (user) => (
        <Text size="sm" fw={500}>
          {user.name}
          {user.id === currentUserId ? (
            <Text component="span" size="xs" c="dimmed">
              {' '}
              (شما)
            </Text>
          ) : null}
        </Text>
      ),
    },
    {
      key: 'login',
      header: 'شناسه ورود',
      cell: (user) => (
        <Text size="sm" ff="monospace" dir="ltr" ta="start">
          {user.email ?? user.phone ?? '—'}
        </Text>
      ),
    },
    {
      key: 'role',
      header: 'نقش',
      cardHead: true,
      cell: roleBadge,
    },
    {
      key: 'wallet',
      header: 'کیف پول',
      cell: (user) => (
        <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {enCurrency(user.walletBalance, false)}
        </Text>
      ),
    },
    {
      key: 'joined',
      header: 'عضویت',
      cell: (user) => (
        <Text size="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {faJalaliDate(new Date(user.createdAt))}
        </Text>
      ),
    },
  ];

  return (
    <>
      <ListFilterForm
        action="/users"
        hasFilters={Boolean(search.trim())}
        actions={
          <Button size="sm" leftSection={<IconPlus size={16} />} component={Link} href="/users/new">
            کاربر جدید
          </Button>
        }
      >
        <TextInput
          name="q"
          defaultValue={search}
          size="sm"
          radius="md"
          placeholder="جستجو: نام، ایمیل، شماره موبایل…"
          aria-label="جستجوی کاربر"
          style={{ flex: '1 1 220px' }}
        />
      </ListFilterForm>

      <PanelList<AdminUserDTO>
        rows={filtered}
        columns={columns}
        getRowId={(user) => user.id}
        renderActions={(user) => (
          <Group gap="xs" wrap="nowrap">
            <Button
              variant="light"
              size="compact-xs"
              component={Link}
              href={`/users/${user.id}/edit`}
            >
              ویرایش
            </Button>
            <ActionIcon
              color="red"
              variant="subtle"
              aria-label={`حذف ${user.name}`}
              disabled={user.id === currentUserId}
              onClick={() => setDeleting(user)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        )}
        empty={
          filtered.length === 0 && users.length > 0
            ? {
                icon: IconSearch,
                message: 'کاربری مطابق جستجو یافت نشد.',
                hint: 'عبارت دیگری جستجو کنید یا فیلتر را حذف کنید.',
              }
            : {
                icon: IconUser,
                message: 'هنوز کاربری ثبت نشده است.',
                hint: 'اولین کاربر تیم با دکمه «کاربر جدید» ساخته می‌شود.',
              }
        }
      />

      {/* Delete confirmation — never window.confirm (project convention). */}
      <ResponsiveModal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف کاربر"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            کاربر{' '}
            <Text component="span" fw={700}>
              {deleting?.name}
            </Text>{' '}
            حذف شود؟ سفارش‌ها و تراکنش‌های کیف پول او حفظ می‌شوند اما دیگر نمی‌تواند وارد شود.
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
