'use client';

import { useState } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { Button, Group, Modal, PasswordInput, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';

export interface ChangePasswordModalProps {
  opened: boolean;
  onClose: () => void;
}

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * The shortest length the server accepts (lib/users.ts changePassword refuses
 * anything shorter, and so does the admin's user form). Kept here only so the
 * client can say so before a round trip; the server stays the authority.
 * Note the message below spells the same number as the Persian «۸» — an ASCII
 * digit in user-facing text would sit wrong beside the rest of the sentence.
 */
const MIN_PASSWORD_LENGTH = 8;

/**
 * The «تغییر رمز عبور» dialog behind the user menu.
 *
 * The current password is required even though the session already proves who
 * is asking: a session cookie left open on a shared machine must not be enough
 * to lock the owner out of their own account. Sessions are stateless, so the
 * ones already open elsewhere stay valid — the notification says so rather than
 * letting the user assume otherwise.
 */
export default function ChangePasswordModal({ opened, onClose }: ChangePasswordModalProps) {
  const [saving, setSaving] = useState(false);

  const form = useForm<PasswordFormValues>({
    mode: 'uncontrolled',
    initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    validate: {
      currentPassword: (value) => (value ? null : 'گذرواژه فعلی را وارد کنید.'),
      newPassword: (value) =>
        value.length >= MIN_PASSWORD_LENGTH ? null : 'گذرواژه جدید باید حداقل ۸ نویسه باشد.',
      confirmPassword: (value, values) =>
        value === values.newPassword ? null : 'تکرار گذرواژه با گذرواژه جدید یکسان نیست.',
    },
  });

  // Closing wipes the typed passwords: they have no business surviving in the
  // form state of a dropdown the user may reopen later.
  function close() {
    form.reset();
    onClose();
  }

  async function handleSubmit(values: PasswordFormValues) {
    setSaving(true);
    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'تغییر گذرواژه ناموفق بود.',
          color: 'red',
        });
        return;
      }

      notifications.show({
        title: 'انجام شد',
        message: 'گذرواژه شما تغییر کرد. نشست‌های باز روی دستگاه‌های دیگر معتبر می‌مانند.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      close();
    } catch {
      notifications.show({
        title: 'خطا',
        message: 'ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal opened={opened} onClose={close} title="تغییر رمز عبور" centered>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <PasswordInput
            label="گذرواژه فعلی"
            key={form.key('currentPassword')}
            {...form.getInputProps('currentPassword')}
          />

          <PasswordInput
            label="گذرواژه جدید"
            description="حداقل ۸ نویسه"
            key={form.key('newPassword')}
            {...form.getInputProps('newPassword')}
          />

          <PasswordInput
            label="تکرار گذرواژه جدید"
            key={form.key('confirmPassword')}
            {...form.getInputProps('confirmPassword')}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={close} disabled={saving}>
              انصراف
            </Button>
            <Button type="submit" loading={saving}>
              ذخیره
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
