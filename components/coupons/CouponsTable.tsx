'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconPlus, IconTicket, IconTrash, IconWallet } from '@tabler/icons-react';
import { ActionIcon, Badge, Button, Group, Stack, Switch, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import ListFilterForm from '@/components/ui/panel/ListFilterForm';
import PanelList, { type PanelColumn } from '@/components/ui/panel/PanelList';
import ResponsiveModal from '@/components/ui/panel/ResponsiveModal';
import type { CouponDTO } from '@/lib/coupons';
import { enCurrency, faJalaliDate, enNumber, enPercent } from '@/lib/format';

/** ISO expiry as a Jalali date for the table. */
function expiryLabel(coupon: CouponDTO): string {
  return coupon.expiresAt ? faJalaliDate(new Date(coupon.expiresAt)) : '—';
}

/** Persian label for the discount amount column. */
function valueLabel(coupon: CouponDTO): string {
  return coupon.type === 'percent'
    ? enPercent(coupon.value, { fractionDigits: 0 })
    : enCurrency(coupon.value, false);
}

/** The targeting chips shown in the assignment column. */
function targetingChips(coupon: CouponDTO): { label: string; fw: boolean }[] {
  const chips: { label: string; fw: boolean }[] = [];
  if (coupon.customerName) {
    chips.push({ label: `مشتری: ${coupon.customerName}`, fw: true });
  }
  if (coupon.productName) {
    chips.push({ label: `محصول: ${coupon.productName}`, fw: true });
  }
  if (coupon.categoryName) {
    chips.push({ label: `دسته: ${coupon.categoryName}`, fw: true });
  }
  if (coupon.minPurchaseAmount !== null) {
    chips.push({
      label: `حداقل خرید: ${enCurrency(coupon.minPurchaseAmount, false)} تومان`,
      fw: true,
    });
  }
  if (coupon.purchasedProductName) {
    chips.push({
      label: `خریدار ${coupon.purchasedProductName}${
        coupon.purchasedFrom || coupon.purchasedTo
          ? ` (${faJalaliDate(new Date(coupon.purchasedFrom ?? coupon.purchasedTo!))}…)`
          : ''
      }`,
      fw: true,
    });
  }
  if (coupon.purchaseTotalOperator && coupon.purchaseTotalAmount !== null) {
    const compare =
      coupon.purchaseTotalOperator === 'gt'
        ? 'بیشتر از'
        : coupon.purchaseTotalOperator === 'lt'
          ? 'کمتر از'
          : 'برابر با';
    chips.push({
      label: `مجموع خرید قبلی ${compare} ${enCurrency(coupon.purchaseTotalAmount, false)} تومان`,
      fw: true,
    });
  }
  return chips;
}

export interface CouponsTableProps {
  coupons: CouponDTO[];
  /** The create button only renders for roles with coupons:add. */
  canAdd: boolean;
  /** Toggle/edit/delete only render for roles with coupons:edit — the API
   *  enforces it regardless. */
  canEdit: boolean;
}

/**
 * The admin coupon manager: the list plus an active/inactive toggle and
 * delete with confirmation. Create/edit live on their own dedicated pages
 * (/coupons/new و /coupons/[id]/edit) — فرم‌های بیش از ۴ فیلد مودال باز
 * نمی‌شوند. All writes go through /api/coupons — this component only
 * refreshes the server data afterwards.
 */
export default function CouponsTable({ coupons, canAdd, canEdit }: CouponsTableProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<CouponDTO | null>(null);

  /** Flips a coupon on/off — PATCH needs the full body, so it's rebuilt here. */
  async function handleToggle(coupon: CouponDTO) {
    try {
      const response = await fetch(`/api/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          isActive: !coupon.isActive,
          expiresAt: coupon.expiresAt,
          maxUses: coupon.maxUses,
          customerId: coupon.customerId,
          productId: coupon.productId,
          minPurchaseAmount: coupon.minPurchaseAmount,
          categoryId: coupon.categoryId,
          purchasedProductId: coupon.purchasedProductId,
          purchasedFrom: coupon.purchasedFrom,
          purchasedTo: coupon.purchasedTo,
          purchaseTotalOperator: coupon.purchaseTotalOperator,
          purchaseTotalAmount: coupon.purchaseTotalAmount,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        notifications.show({
          title: 'تغییر وضعیت ناموفق بود',
          message: payload.error ?? 'لطفاً دوباره تلاش کنید.',
          color: 'red',
        });
        return;
      }
      router.refresh();
    } catch {
      notifications.show({
        title: 'ارتباط برقرار نشد',
        message: 'اتصال خود را بررسی کنید.',
        color: 'red',
      });
    }
  }

  async function handleDelete() {
    if (!deleting) {
      return;
    }

    try {
      const response = await fetch(`/api/coupons/${deleting.id}`, { method: 'DELETE' });
      if (!response.ok) {
        notifications.show({
          title: 'حذف ناموفق بود',
          message: 'لطفاً دوباره تلاش کنید.',
          color: 'red',
        });
        return;
      }
      notifications.show({
        title: 'کد تخفیف حذف شد',
        message: deleting.code,
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

  const columns: PanelColumn<CouponDTO>[] = [
    {
      key: 'code',
      header: 'کد',
      cardTitle: true,
      card: (coupon) => coupon.code,
      cell: (coupon) => (
        <Text size="sm" ff="monospace" fw={600}>
          {coupon.code}
        </Text>
      ),
    },
    {
      key: 'type',
      header: 'نوع',
      cardHead: true,
      cell: (coupon) => (
        <Badge
          variant="light"
          color={coupon.type === 'percent' ? 'blue' : 'teal'}
          radius="sm"
          size="sm"
        >
          {coupon.type === 'percent' ? 'درصدی' : 'مبلغی'}
        </Badge>
      ),
    },
    {
      key: 'value',
      header: 'مقدار',
      cell: (coupon) => (
        <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {valueLabel(coupon)}
        </Text>
      ),
    },
    {
      key: 'conditions',
      header: 'شرایط استفاده',
      cell: (coupon) => {
        const chips = targetingChips(coupon);
        return chips.length > 0 ? (
          <Stack gap={4}>
            {chips.map((chip) => (
              <Text key={chip.label} size="xs" lineClamp={1} maw={260}>
                <Text component="span" fw={chip.fw ? 600 : undefined}>
                  {chip.label}
                </Text>
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size="xs" c="dimmed">
            همه
          </Text>
        );
      },
    },
    {
      key: 'used',
      header: 'استفاده',
      cell: (coupon) => (
        <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {enNumber(coupon.usedCount)}
          {coupon.maxUses !== null ? ` / ${enNumber(coupon.maxUses)}` : ''}
        </Text>
      ),
    },
    {
      key: 'expiry',
      header: 'انقضا',
      cell: (coupon) => (
        <Text
          size="sm"
          style={{ fontVariantNumeric: 'tabular-nums' }}
          c={
            coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now() ? 'red' : 'dimmed'
          }
        >
          {expiryLabel(coupon)}
        </Text>
      ),
    },
  ];

  if (canEdit) {
    columns.push({
      key: 'active',
      header: 'فعال',
      cardHead: false,
      cell: (coupon) => (
        <Switch
          aria-label={`فعال بودن ${coupon.code}`}
          checked={coupon.isActive}
          onChange={() => void handleToggle(coupon)}
        />
      ),
    });
  }

  return (
    <>
      <ListFilterForm
        action="/coupons"
        actions={
          canAdd ? (
            <Button
              size="sm"
              leftSection={<IconPlus size={16} />}
              component={Link}
              href="/coupons/new"
            >
              کد تخفیف جدید
            </Button>
          ) : undefined
        }
      >
        {null}
      </ListFilterForm>

      <PanelList<CouponDTO>
        rows={coupons}
        columns={columns}
        getRowId={(coupon) => coupon.id}
        renderActions={
          canEdit
            ? (coupon) => (
                <Group gap="xs" wrap="nowrap">
                  <Button
                    variant="light"
                    size="compact-xs"
                    component={Link}
                    href={`/coupons/${coupon.id}/edit`}
                  >
                    ویرایش
                  </Button>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    aria-label={`حذف ${coupon.code}`}
                    onClick={() => setDeleting(coupon)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              )
            : undefined
        }
        empty={{
          icon: IconTicket,
          message: 'هنوز کد تخفیفی ثبت نشده است.',
          hint: 'اولین کد تخفیف با دکمه «کد تخفیف جدید» ساخته می‌شود.',
        }}
      />

      {/* Delete confirmation — never window.confirm (project convention). */}
      <ResponsiveModal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف کد تخفیف"
        size="sm"
      >
        <Stack gap="md">
          <Group gap="xs">
            <IconWallet size={18} />
            <Text size="sm">
              کد تخفیف{' '}
              <Text component="span" ff="monospace" fw={700}>
                {deleting?.code}
              </Text>{' '}
              حذف شود؟ کاربرد قبلی آن در سفارش‌ها حفظ می‌شود.
            </Text>
          </Group>
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
