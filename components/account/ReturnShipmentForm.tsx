'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconAlertCircle, IconCircleCheck, IconPhoto } from '@tabler/icons-react';
import {
  Button,
  Card,
  FileInput,
  Group,
  Image,
  NumberInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

export interface ReturnShipmentFormProps {
  returnId: string;
  /** هزینه ارسال با کیست — 'shop' یعنی پس از تایید به کیف پول مشتری برمی‌گردد. */
  shippingPayerLabel: string;
}

const MAX_SHIPPING_COST = 50_000_000;
/** قرارداد عکس رسید — همان قواعد سخت‌گیرانهٔ پیوست پشتیبانی (lib/upload-image). */
const MAX_RECEIPT_BYTES = 200 * 1024;

/**
 * ثبت مدارک ارسال مرسوله برگشتی توسط مشتری (روش «ارسال توسط مشتری»): کد
 * رهگیری، هزینه ارسال و عکس رسید. پس از ثبت، فروشگاه کالا را دریافت و تسویه
 * می‌کند.
 */
export default function ReturnShipmentForm({
  returnId,
  shippingPayerLabel,
}: ReturnShipmentFormProps) {
  const router = useRouter();
  const [trackingCode, setTrackingCode] = useState('');
  const [cost, setCost] = useState<number | ''>('');
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function uploadReceipt(file: File) {
    // چک زودهنگام کلاینت — سرور با magic-byte دوباره سخت می‌گیرد.
    if (file.size > MAX_RECEIPT_BYTES) {
      notifications.show({
        title: 'خطا',
        message: 'حجم عکس رسید باید حداکثر ۲۰۰ کیلوبایت باشد.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
      return;
    }
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      notifications.show({
        title: 'خطا',
        message: 'فقط تصاویر JPG و PNG پذیرفته می‌شوند.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'shipping');
      const response = await fetch('/api/account/returns/upload', { method: 'POST', body: form });
      const payload = (await response.json().catch(() => ({}))) as {
        path?: string;
        error?: string;
      };
      if (!response.ok || !payload.path) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'بارگذاری تصویر رسید ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }
      setReceiptPath(payload.path);
    } catch {
      notifications.show({
        title: 'خطا',
        message: 'ارتباط با سرور برقرار نشد.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/account/returns/${returnId}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingCode,
          shippingCost: cost === '' ? null : cost,
          receiptPath,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'ثبت مدارک ارسال ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }
      notifications.show({
        title: 'ثبت شد',
        message: 'مدارک ارسال مرسوله ثبت شد و در انتظار دریافت کالا توسط فروشگاه است.',
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
      router.refresh();
    } catch {
      notifications.show({
        title: 'خطا',
        message: 'ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Text size="sm" fw={600}>
          ثبت مدارک ارسال مرسوله
        </Text>
        <Text size="xs" c="dimmed">
          هزینه ارسال با {shippingPayerLabel} است.
          {shippingPayerLabel === 'فروشگاه'
            ? ' مبلغ اعلامی شما پس از تایید مدارک و دریافت کالا به کیف پولتان اضافه می‌شود.'
            : ' این هزینه به عهده شماست و به کیف پول برنمی‌گردد.'}
        </Text>
        <TextInput
          label="کد رهگیری مرسوله"
          placeholder="مثلاً 123456789012345678"
          maxLength={100}
          value={trackingCode}
          onChange={(event) => setTrackingCode(event.currentTarget.value)}
          required
        />
        <NumberInput
          label="هزینه ارسال (تومان)"
          min={0}
          max={MAX_SHIPPING_COST}
          thousandSeparator=","
          value={cost}
          onChange={(value) => setCost(typeof value === 'number' ? value : '')}
          required
        />
        <FileInput
          label="عکس رسید مرسوله"
          description="JPG یا PNG — حداکثر ۲۰۰ کیلوبایت"
          accept="image/png,image/jpeg"
          placeholder="انتخاب عکس رسید"
          leftSection={<IconPhoto size={16} />}
          disabled={uploading}
          onChange={(file) => {
            if (file) {void uploadReceipt(file);}
          }}
          required
        />
        {receiptPath ? (
          <Image src={`/api/files/${receiptPath}`} h={96} w="auto" fit="contain" radius="sm" />
        ) : null}
        <Group justify="flex-end">
          <Button type="button" loading={submitting} onClick={() => void handleSubmit()}>
            ثبت مدارک ارسال
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
