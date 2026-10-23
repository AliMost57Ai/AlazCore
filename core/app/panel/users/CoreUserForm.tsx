'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Group,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

export interface CoreUserFormRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export interface CoreUserFormProps {
  roles: { name: string; title: string }[];
  /** کاربر موجود در حالت ویرایش — null = ایجاد. */
  initial?: CoreUserFormRow | null;
}

interface FormState {
  name: string;
  email: string;
  role: string;
  password: string;
  isActive: boolean;
}

const EMPTY: FormState = { name: '', email: '', role: 'support', password: '', isActive: true };

/**
 * فرم ایجاد/ویرایش کاربر پنل Core — صفحات اختصاصی /panel/users/new و
 * …/[id]/edit (فرم‌های بیش از ۴ فیلد مودال باز نمی‌شوند). همان API قبلی
 * (/api/users)؛ پس از ذخیره به فهرست کاربران برمی‌گردد.
 */
export default function CoreUserForm({ roles, initial }: CoreUserFormProps) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          name: initial.name,
          email: initial.email,
          role: initial.role,
          password: '',
          isActive: initial.isActive,
        }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        role: form.role,
        isActive: form.isActive,
      };
      if (form.password) {
        payload.password = form.password;
      }
      const response = await fetch(initial ? `/api/users/${initial.id}` : '/api/users', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initial ? payload : { ...payload, email: form.email }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        notifications.show({ message: data.error ?? 'ذخیره ناموفق بود.', color: 'crimson' });
        return;
      }
      notifications.show({ message: 'کاربر ذخیره شد.', color: 'brand' });
      router.push('/panel/users');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          label="نام"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
        />
        <TextInput
          label="ایمیل"
          dir="ltr"
          required
          disabled={editing}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
        />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Select
          label="نقش"
          data={roles.map((r) => ({ value: r.name, label: r.title }))}
          value={form.role}
          onChange={(value) => setForm({ ...form, role: value ?? 'support' })}
        />
        <PasswordInput
          label={editing ? 'رمز جدید (اختیاری)' : 'رمز عبور'}
          description="حداقل ۸ نویسه"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
        />
      </SimpleGrid>
      <Switch
        label="فعال"
        checked={form.isActive}
        onChange={(e) => setForm({ ...form, isActive: e.currentTarget.checked })}
      />
      <Group justify="end" mt="md">
        <Button variant="subtle" component={Link} href="/panel/users">
          انصراف
        </Button>
        <Button loading={saving} onClick={save}>
          ذخیره کاربر
        </Button>
      </Group>
    </Stack>
  );
}
