'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';

export interface CancelReturnButtonProps {
  returnId: string;
  displayId: string;
}

/** لغو درخواست مرجوعی توسط مشتری — فقط تا قبل از بررسی فروشگاه، با تایید دوباره. */
export default function CancelReturnButton({ returnId, displayId }: CancelReturnButtonProps) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleCancel() {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/account/returns/${returnId}/cancel`, { method: 'POST' });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'لغو درخواست ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }
      notifications.show({
        title: 'لغو شد',
        message: `درخواست مرجوعی ${displayId} لغو شد.`,
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
      setOpened(false);
      router.refresh();
    } catch {
      notifications.show({
        title: 'خطا',
        message: 'ارتباط با سرور برقرار نشد.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="light" color="red" size="sm" onClick={() => setOpened(true)}>
        لغو درخواست
      </Button>
      <Modal opened={opened} onClose={() => setOpened(false)} title="لغو درخواست مرجوعی" centered>
        <Stack gap="md">
          <Text size="sm">
            درخواست مرجوعی {displayId} لغو شود؟ این عمل بازگشت‌پذیر نیست و برای این سفارش می‌توانید
            درخواست جدیدی ثبت کنید.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setOpened(false)} disabled={submitting}>
              انصراف
            </Button>
            <Button color="red" loading={submitting} onClick={() => void handleCancel()}>
              لغو درخواست
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
