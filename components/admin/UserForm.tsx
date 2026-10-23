'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconUser } from '@tabler/icons-react';
import { Button, Group, PasswordInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { RoleDTO } from '@/lib/roles';
import type { AdminUserDTO } from '@/lib/users-admin';

/** The create/edit form values. */
interface UserFormValues {
  name: string;
  email: string;
  phone: string;
  role: string;
  password: string;
}

const EMPTY_FORM: UserFormValues = { name: '', email: '', phone: '', role: 'member', password: '' };

export interface UserFormProps {
  /** The selectable roles (machine name ↔ Persian title). */
  roles: RoleDTO[];
  /** Existing user in edit mode — null/undefined = create. */
  initial?: AdminUserDTO | null;
}

/**
 * فرم ایجاد/ویرایش کاربر پنل فروشگاه — صفحات اختصاصی /users/new و
 * /users/[id]/edit (فرم‌های بیش از ۴ فیلد مودال باز نمی‌شوند). همان
 * اعتبارسنجی و همان API (/api/admin/users)؛ پس از ذخیره به فهرست برمی‌گردد.
 */
export default function UserForm({ roles, initial }: UserFormProps) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [form, setForm] = useState<UserFormValues>(() =>
    initial
      ? {
          name: initial.name,
          email: initial.email ?? '',
          phone: initial.phone ?? '',
          role: initial.role,
          password: '',
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // The customer role never appears here — customers are managed on /customers.
  const roleOptions = roles
    .filter((role) => role.name !== 'customer')
    .map((role) => ({
      value: role.name,
      label: `${role.title}${role.isAdmin ? ' — دسترسی مدیر' : ''}`,
    }));

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
        initial ? `/api/admin/users/${initial.id}` : '/api/admin/users',
        {
          method: initial ? 'PATCH' : 'POST',
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
      router.push('/users');
    } catch {
      setFormError('ارتباط با سرور برقرار نشد.');
    } finally {
      setSaving(false);
    }
  }

  return (
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
        <Button variant="subtle" component={Link} href="/users">
          انصراف
        </Button>
        <Button loading={saving} onClick={handleSubmit}>
          {editing ? 'ذخیره تغییرات' : 'ساخت کاربر'}
        </Button>
      </Group>
    </Stack>
  );
}
