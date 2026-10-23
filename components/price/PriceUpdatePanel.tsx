'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconCheck } from '@tabler/icons-react';
import {
  Button,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import PriceChangesTable from '@/components/ui/panel/PriceChangesTable';
import ResponsiveModal from '@/components/ui/panel/ResponsiveModal';
import { enNumber } from '@/lib/format';
import {
  computeNewPrice,
  describeAdjust,
  type PlannedPriceChange,
  type PriceAdjustType,
  type PriceUpdateScope,
} from '@/lib/price-adjust';

/** One selectable group/category, with the ids it covers (itself + children). */
export interface PriceCategoryOption {
  id: string;
  label: string;
  /** The category itself plus every descendant — products in any of these move. */
  covers: string[];
}

export interface PriceProductOption {
  id: string;
  name: string;
  price: number;
  categoryIds: string[];
  variants: { id: string; name: string; price: number | null }[];
}

export interface PriceUpdatePanelProps {
  categories: PriceCategoryOption[];
  products: PriceProductOption[];
}

/**
 * The batch price updater (Finance → به‌روزرسانی قیمت): pick a group/category
 * or a single product, choose a fixed Toman delta or a percent, see the exact
 * preview of every price that would move, then apply. The server writes a
 * PriceChange history row per change; sold invoices are never touched.
 */
export default function PriceUpdatePanel({ categories, products }: PriceUpdatePanelProps) {
  const router = useRouter();
  const [scope, setScope] = useState<PriceUpdateScope>('category');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [adjustType, setAdjustType] = useState<PriceAdjustType>('percent');
  const [amount, setAmount] = useState<number | ''>('');
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  // The preview is computed with the same pure helper the server applies with,
  // so what the admin sees is exactly what lands in the DB.
  const changes = useMemo<PlannedPriceChange[]>(() => {
    const value = typeof amount === 'number' ? amount : null;
    if (!targetId || value === null || value === 0) {
      return [];
    }

    const inScope =
      scope === 'category'
        ? products.filter((product) =>
            product.categoryIds.some((id) =>
              (categories.find((category) => category.id === targetId)?.covers ?? []).includes(id)
            )
          )
        : products.filter((product) => product.id === targetId);

    const planned: PlannedPriceChange[] = [];
    for (const product of inScope) {
      const newPrice = computeNewPrice(product.price, adjustType, value);
      if (newPrice !== product.price) {
        planned.push({
          productId: product.id,
          productName: product.name,
          variantId: null,
          variantName: null,
          oldPrice: product.price,
          newPrice,
        });
      }
      for (const variant of product.variants) {
        if (variant.price === null) {
          continue; // inherits the product price — moves with it, no own row
        }
        const variantNew = computeNewPrice(variant.price, adjustType, value);
        if (variantNew !== variant.price) {
          planned.push({
            productId: product.id,
            productName: product.name,
            variantId: variant.id,
            variantName: variant.name,
            oldPrice: variant.price,
            newPrice: variantNew,
          });
        }
      }
    }
    return planned;
  }, [scope, targetId, adjustType, amount, categories, products]);

  const targetOptions =
    scope === 'category'
      ? categories.map((category) => ({ value: category.id, label: category.label }))
      : products.map((product) => ({ value: product.id, label: product.name }));

  const invalidAmount =
    typeof amount === 'number' &&
    amount !== 0 &&
    ((adjustType === 'percent' && (amount < -100 || amount > 1000)) ||
      (adjustType === 'fixed' && Math.abs(amount) > 1_000_000_000));

  const targetLabel =
    scope === 'category'
      ? categories.find((category) => category.id === targetId)?.label
      : products.find((product) => product.id === targetId)?.name;

  const canApply =
    Boolean(targetId) && typeof amount === 'number' && amount !== 0 && !invalidAmount;

  async function apply() {
    setLoading(true);
    try {
      const response = await fetch('/api/price-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, targetId, adjustType, adjustValue: amount }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        applied?: number;
      };

      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'عملیات ناموفق بود.',
          color: 'red',
        });
        return;
      }

      notifications.show({
        message: `${enNumber(payload.applied ?? 0)} قیمت با موفقیت به‌روزرسانی شد.`,
        color: 'green',
      });
      setAmount('');
      setConfirming(false);
      router.refresh();
    } catch {
      notifications.show({
        title: 'خطا',
        message: 'ارتباط با سرور برقرار نشد.',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <Stack gap="md">
        <Group grow align="flex-start" preventGrowOverflow={false}>
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              هدف تغییر
            </Text>
            <SegmentedControl
              value={scope}
              onChange={(value) => {
                setScope(value as PriceUpdateScope);
                setTargetId(null);
              }}
              data={[
                { value: 'category', label: 'گروه کالا' },
                { value: 'product', label: 'کالا' },
              ]}
              w="100%"
            />
            <Select
              placeholder={
                scope === 'category' ? 'یک گروه یا دسته انتخاب کنید' : 'یک کالا انتخاب کنید'
              }
              data={targetOptions}
              value={targetId}
              onChange={setTargetId}
              searchable
              clearable
            />
          </Stack>

          <Stack gap="xs">
            <Text size="sm" fw={500}>
              نوع و مقدار تغییر
            </Text>
            <SegmentedControl
              value={adjustType}
              onChange={(value) => setAdjustType(value as PriceAdjustType)}
              data={[
                { value: 'percent', label: 'درصد' },
                { value: 'fixed', label: 'عدد ثابت (تومان)' },
              ]}
              w="100%"
            />
            <NumberInput
              placeholder={adjustType === 'percent' ? 'مثلاً ۱۰ یا ‎-۱۰' : 'مثلاً ۵۰۰۰۰ یا ‎-۵۰۰۰۰'}
              min={adjustType === 'percent' ? -100 : undefined}
              max={adjustType === 'percent' ? 1000 : undefined}
              step={adjustType === 'percent' ? 1 : 1000}
              thousandSeparator={adjustType === 'fixed' ? ',' : undefined}
              allowDecimal={false}
              hideControls
              dir="ltr"
              value={amount}
              onChange={(value) => setAmount(typeof value === 'number' ? value : '')}
              error={invalidAmount ? 'مقدار واردشده نامعتبر است.' : undefined}
            />
            <Text size="xs" c="dimmed">
              مقدار منفی = کاهش قیمت. قیمت‌ها هرگز از صفر کمتر نمی‌شوند.
            </Text>
          </Stack>
        </Group>

        {targetId && typeof amount === 'number' && amount !== 0 && !invalidAmount ? (
          changes.length > 0 ? (
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                پیش‌نمایش: {enNumber(changes.length)} تغییر قیمت — {targetLabel} (
                {describeAdjust(adjustType, amount)})
              </Text>
              {/* پیش‌نمایش با همان جدول مشترک تاریخچه — شکل یکسان همه‌جا. */}
              <PriceChangesTable changes={changes} />
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              هیچ قیمتی با این تغییر جابه‌جا نمی‌شود.
            </Text>
          )
        ) : null}

        <Group justify="flex-end">
          <Button
            leftSection={<IconCheck size={16} />}
            disabled={!canApply || changes.length === 0}
            onClick={() => setConfirming(true)}
          >
            اعمال تغییرات
          </Button>
        </Group>
      </Stack>

      <ResponsiveModal
        opened={confirming}
        onClose={() => setConfirming(false)}
        title="اعمال تغییرات قیمت"
      >
        <Stack gap="sm">
          <Text size="sm">
            {enNumber(changes.length)} قیمت در «{targetLabel}» با{' '}
            {describeAdjust(adjustType, typeof amount === 'number' ? amount : 0)} به‌روزرسانی شود؟
            قیمت سفارش‌های قبلی تغییر نمی‌کند و این تغییر در تاریخچه ثبت می‌شود.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setConfirming(false)}>
              انصراف
            </Button>
            <Button loading={loading} onClick={apply}>
              ثبت
            </Button>
          </Group>
        </Stack>
      </ResponsiveModal>
    </Card>
  );
}
