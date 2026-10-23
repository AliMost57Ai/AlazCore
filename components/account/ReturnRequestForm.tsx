'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconAlertCircle, IconCircleCheck, IconPhoto, IconTrash } from '@tabler/icons-react';
import {
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  FileInput,
  Group,
  Image,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { faCurrency, faNumber } from '@/lib/format';
import { computeRefundAmount, RETURN_REASON_LABELS, type ReturnLine } from '@/lib/return-status';

export interface ReturnRequestFormProps {
  orderId: string;
  orderDisplayId: string;
  lines: Array<ReturnLine & { remaining: number }>;
  paidGoodsTotal: number;
  committedAmount: number;
  windowDays: number;
  windowEndsLabel: string;
}

interface SelectedMap {
  /** کلید «productId|variantId» → تعداد انتخابی */
  [key: string]: number;
}

/**
 * فرم درخواست مرجوعی مشتری: انتخاب قلم/تعداد (تا سقف قابل مرجوع)، علت با
 * توضیح و حداکثر ۳ عکس. مبلغ بازگشتی به‌صورت برآورد نمایشی با همان فرمول
 * سرور (computeRefundAmount) محاسبه می‌شود؛ مبلغ نهایی را سرور قفل می‌کند.
 */
export default function ReturnRequestForm({
  orderId,
  orderDisplayId,
  lines,
  paidGoodsTotal,
  committedAmount,
  windowDays,
  windowEndsLabel,
}: ReturnRequestFormProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedMap>({});
  const [reasonKind, setReasonKind] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedLines = useMemo(
    () =>
      lines
        .filter((line) => (selected[`${line.productId}|${line.variantId ?? ''}`] ?? 0) > 0)
        .map((line) => ({
          ...line,
          qty: selected[`${line.productId}|${line.variantId ?? ''}`],
        })),
    [lines, selected]
  );

  const estimate = useMemo(() => {
    const raw = computeRefundAmount(selectedLines, lines, paidGoodsTotal);
    return Math.min(raw, Math.max(paidGoodsTotal - committedAmount, 0));
  }, [selectedLines, lines, paidGoodsTotal, committedAmount]);

  async function uploadImage(file: File) {
    if (images.length >= 3) {
      notifications.show({
        title: 'حد نصاب پر است',
        message: 'حداکثر ۳ تصویر برای هر درخواست مجاز است.',
        color: 'orange',
      });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/account/returns/upload', { method: 'POST', body: form });
      const payload = (await response.json().catch(() => ({}))) as {
        path?: string;
        error?: string;
      };
      if (!response.ok || !payload.path) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'بارگذاری تصویر ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }
      setImages((current) => [...current, payload.path as string]);
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

  function toggleLine(line: ReturnLine, checked: boolean) {
    const key = `${line.productId}|${line.variantId ?? ''}`;
    setSelected((current) => {
      const next = { ...current };
      if (checked) {
        next[key] = 1;
      } else {
        delete next[key];
      }
      return next;
    });
  }

  function setQty(line: ReturnLine, qty: number | '') {
    const key = `${line.productId}|${line.variantId ?? ''}`;
    setSelected((current) => ({ ...current, [key]: typeof qty === 'number' ? qty : 1 }));
  }

  async function handleSubmit() {
    if (selectedLines.length === 0) {
      notifications.show({ title: 'خطا', message: 'حداقل یک قلم را انتخاب کنید.', color: 'red' });
      return;
    }
    if (!reasonKind) {
      notifications.show({ title: 'خطا', message: 'علت مرجوعی را انتخاب کنید.', color: 'red' });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/account/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          reasonKind,
          reason,
          images,
          items: selectedLines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            qty: line.qty,
          })),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        displayId?: string;
        error?: string;
      };
      if (!response.ok || !payload.displayId) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'ثبت درخواست مرجوعی ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }
      notifications.show({
        title: 'ثبت شد',
        message: `درخواست مرجوعی ${payload.displayId} ثبت شد و در انتظار بررسی فروشگاه است.`,
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
      router.push(`/account/returns/${payload.displayId}`);
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
      <Stack gap="md">
        <Title order={2} fz="h5">
          درخواست مرجوعی سفارش {orderDisplayId}
        </Title>
        <Text size="xs" c="dimmed">
          مهلت مرجوعی این سفارش {faNumber(windowDays)} روز از تحویل است و تا {windowEndsLabel} فرصت
          دارید.
        </Text>

        <Divider label="اقلام مرجوعی" labelPosition="center" />

        <Stack gap="sm">
          {lines.map((line) => {
            const key = `${line.productId}|${line.variantId ?? ''}`;
            const checked = (selected[key] ?? 0) > 0;
            return (
              <Box key={key}>
                <Checkbox
                  label={`${line.name} — ${faCurrency(line.unitPrice, false)}`}
                  description={
                    line.remaining < line.qty
                      ? `قابل مرجوع از این قلم: ${faNumber(line.remaining)} عدد`
                      : `سفارش‌داده: ${faNumber(line.qty)} عدد`
                  }
                  checked={checked}
                  disabled={line.remaining < 1}
                  onChange={(event) => toggleLine(line, event.currentTarget.checked)}
                />
                {checked ? (
                  <NumberInput
                    mt={6}
                    ml="xl"
                    label="تعداد"
                    min={1}
                    max={line.remaining}
                    value={selected[key] ?? 1}
                    onChange={(value) => setQty(line, value as number)}
                    w={140}
                  />
                ) : null}
              </Box>
            );
          })}
        </Stack>

        <Divider label="علت مرجوعی" labelPosition="center" />

        <Select
          label="علت اصلی"
          placeholder="انتخاب کنید"
          data={Object.entries(RETURN_REASON_LABELS).map(([value, label]) => ({ value, label }))}
          value={reasonKind}
          onChange={setReasonKind}
          required
          w={{ base: '100%', sm: 320 }}
        />
        <Textarea
          label="توضیح"
          description="مشکل کالا یا دلیل مرجوعی را شرح دهید (حداقل ۵ نویسه)."
          minRows={3}
          maxLength={1000}
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
          required
        />

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            تصاویر (اختیاری — حداکثر ۳ عکس)
          </Text>
          <FileInput
            placeholder="انتخاب عکس"
            accept="image/png,image/jpeg,image/webp"
            leftSection={<IconPhoto size={16} />}
            disabled={uploading}
            onChange={(file) => {
              if (file) {void uploadImage(file);}
            }}
            w={{ base: '100%', sm: 320 }}
          />
          {images.length > 0 ? (
            <Group gap="sm">
              {images.map((path) => (
                <Box key={path} pos="relative">
                  <Image src={`/api/files/${path}`} h={72} w={72} fit="cover" radius="sm" />
                  <Button
                    pos="absolute"
                    top={-8}
                    left={-8}
                    p={4}
                    w={24}
                    h={24}
                    radius="xl"
                    color="red"
                    variant="filled"
                    aria-label="حذف تصویر"
                    onClick={() => setImages((current) => current.filter((item) => item !== path))}
                  >
                    <IconTrash size={12} />
                  </Button>
                </Box>
              ))}
            </Group>
          ) : null}
        </Stack>

        {estimate > 0 ? (
          <Text size="sm" fw={600}>
            برآورد مبلغ بازگشتی: {faCurrency(estimate, false)} — پس از تایید و دریافت کالا به کیف
            پول شما واریز می‌شود.
          </Text>
        ) : null}

        <Group justify="flex-end">
          <Button
            type="button"
            variant="default"
            onClick={() => router.push('/account/orders')}
            disabled={submitting}
          >
            انصراف
          </Button>
          <Button type="button" loading={submitting} onClick={() => void handleSubmit()}>
            ثبت درخواست مرجوعی
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
