'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconTrash } from '@tabler/icons-react';
import { Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';

export interface RemoveOrderItemButtonProps {
  orderDisplayId: string;
  productId: string;
  variantId: string | null;
  lineName: string;
}

/**
 * حذف یک قلم از سفارش پرداخت‌شده توسط مالک — مودال توضیح اجباری می‌گیرد؛
 * توضیح روی سفارش می‌نشیند و مشتری در کارت سفارشش می‌بیند. مبلغ تناسبی
 * قلم به کیف پول مشتری برمی‌گردد (سمت سرور: lib/order-item-ops).
 */
export default function RemoveOrderItemButton({
  orderDisplayId,
  productId,
  variantId,
  lineName,
}: RemoveOrderItemButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderDisplayId)}/items-remove`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, variantId, note }),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'حذف قلم ناموفق بود.');
        return;
      }
      notifications.show({
        title: 'قلم حذف شد',
        message: `«${lineName}» از سفارش حذف شد و مبلغش به کیف پول مشتری برگشت.`,
        color: 'green',
      });
      setOpen(false);
      setNote('');
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="compact-xs"
        variant="subtle"
        color="red"
        leftSection={<IconTrash size={12} />}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        aria-label={`حذف ${lineName} از سفارش ${orderDisplayId}`}
      >
        حذف از سفارش
      </Button>

      <Modal opened={open} onClose={() => setOpen(false)} title="حذف قلم از سفارش" centered>
        <Stack gap="sm">
          <Text size="sm">
            «{lineName}» از سفارش {orderDisplayId} حذف شود؟ سهم این قلم از مبلغ پرداختی به کیف پول
            مشتری برگشت می‌خورد و توضیح شما روی سفارش برایش نمایش داده می‌شود.
          </Text>
          <Textarea
            label="توضیح برای مشتری"
            description="الزامی — روی کارت سفارش مشتری نمایش داده می‌شود."
            placeholder="مثلاً: این کالا از طرف تامین‌کننده ناموجود شد"
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
            minRows={2}
            maxRows={4}
            maxLength={300}
            error={error}
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" color="gray" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button
              color="red"
              loading={loading}
              disabled={note.trim().length < 3}
              onClick={submit}
            >
              حذف قلم
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
