'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus, IconTicket, IconTrash, IconWallet } from '@tabler/icons-react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { PersianDateTimePicker } from '@/components/ui/PersianDateTimePicker/PersianDateTimePicker';
import { pickerToIso } from '@/components/ui/PersianDateTimePicker/pickerValue';
import type { CouponDTO } from '@/lib/coupons';
import { faCurrency, faJalaliDate, faNumber, faPercent } from '@/lib/format';

/** The shape of the create/edit form values. */
interface CouponFormValues {
  code: string;
  type: 'percent' | 'fixed';
  value: number | '';
  maxUses: number | '';
  /** ISO string or '' — no expiry. */
  expiresAt: string;
  isActive: boolean;
  customerId: string;
  productId: string;
  /** Minimum order total (Toman) — '' = no floor. */
  minPurchaseAmount: number | '';
  /** Category restriction — '' = none. */
  categoryId: string;
  /** Purchase-history eligibility product — '' = none. */
  purchasedProductId: string;
  /** Purchase window bounds, ISO or '' (unbounded). */
  purchasedFrom: string;
  purchasedTo: string;
  /** Purchase-total rule — '' / '' = no rule. */
  purchaseTotalOperator: '' | 'gt' | 'lt' | 'eq';
  purchaseTotalAmount: number | '';
}

const EMPTY_FORM: CouponFormValues = {
  code: '',
  type: 'percent',
  value: '',
  maxUses: '',
  expiresAt: '',
  isActive: true,
  customerId: '',
  productId: '',
  minPurchaseAmount: '',
  categoryId: '',
  purchasedProductId: '',
  purchasedFrom: '',
  purchasedTo: '',
  purchaseTotalOperator: '',
  purchaseTotalAmount: '',
};

/** Local `YYYY-MM-DD` of the picked date — the API gets `…T23:59:59` on save. */
function dateKey(date: Date): string {
  const pad = (part: number): string => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** One selectable customer — the id is what the API stores. */
export interface CouponCustomerOption {
  id: string;
  name: string;
  phone: string;
}

/** One selectable product. */
export interface CouponProductOption {
  id: string;
  name: string;
}

/** One selectable category (group › category). */
export interface CouponCategoryOption {
  id: string;
  label: string;
}

/** ISO expiry as a Jalali date for the table. */
function expiryLabel(coupon: CouponDTO): string {
  return coupon.expiresAt ? faJalaliDate(new Date(coupon.expiresAt)) : '—';
}

/** Persian label for the discount amount column. */
function valueLabel(coupon: CouponDTO): string {
  return coupon.type === 'percent'
    ? faPercent(coupon.value, { fractionDigits: 0 })
    : faCurrency(coupon.value, false);
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
      label: `حداقل خرید: ${faCurrency(coupon.minPurchaseAmount, false)} تومان`,
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
      label: `مجموع خرید قبلی ${compare} ${faCurrency(coupon.purchaseTotalAmount, false)} تومان`,
      fw: true,
    });
  }
  return chips;
}

export interface CouponsTableProps {
  coupons: CouponDTO[];
  /** Registered customers, for the assignment select. */
  customers: CouponCustomerOption[];
  /** Products, for the assignment/product selects. */
  products: CouponProductOption[];
  /** Groups + categories, for the category restriction select. */
  categories: CouponCategoryOption[];
  /** The create button only renders for roles with coupons:add. */
  canAdd: boolean;
  /** Toggle/edit/delete only render for roles with coupons:edit — the API
   *  enforces it regardless. */
  canEdit: boolean;
}

/**
 * The admin coupon manager: the list plus create/edit (one modal), an
 * active/inactive toggle, and delete with confirmation. Coupons can be
 * assigned to one customer, restricted to one product or category, require a
 * minimum purchase, or be reserved for buyers of a specific product within a
 * date window; every customer can use each coupon once. All writes go
 * through /api/coupons — this component only refreshes the server data
 * afterwards.
 */
export default function CouponsTable({
  coupons,
  customers,
  products,
  categories,
  canAdd,
  canEdit,
}: CouponsTableProps) {
  const router = useRouter();
  const [modalOpened, setModalOpened] = useState(false);
  const [editing, setEditing] = useState<CouponDTO | null>(null);
  const [form, setForm] = useState<CouponFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CouponDTO | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpened(true);
  }

  function openEdit(coupon: CouponDTO) {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      maxUses: coupon.maxUses ?? '',
      expiresAt: coupon.expiresAt ?? '',
      isActive: coupon.isActive,
      customerId: coupon.customerId ?? '',
      productId: coupon.productId ?? '',
      minPurchaseAmount: coupon.minPurchaseAmount ?? '',
      categoryId: coupon.categoryId ?? '',
      purchasedProductId: coupon.purchasedProductId ?? '',
      purchasedFrom: coupon.purchasedFrom ?? '',
      purchasedTo: coupon.purchasedTo ?? '',
      purchaseTotalOperator: coupon.purchaseTotalOperator ?? '',
      purchaseTotalAmount: coupon.purchaseTotalAmount ?? '',
    });
    setFormError(null);
    setModalOpened(true);
  }

  /** Validates locally, then POSTs/PATCHes — the API re-validates everything. */
  function validateForm(): string | null {
    if (form.code.trim().length < 3) {
      return 'کد تخفیف باید حداقل ۳ نویسه باشد.';
    }
    const value = Number(form.value);
    if (!Number.isInteger(value) || value < 1 || (form.type === 'percent' && value > 100)) {
      return form.type === 'percent'
        ? 'درصد تخفیف باید عددی بین ۱ تا ۱۰۰ باشد.'
        : 'مبلغ تخفیف باید عددی مثبت باشد.';
    }
    if (
      form.maxUses !== '' &&
      (!Number.isInteger(Number(form.maxUses)) || Number(form.maxUses) < 1)
    ) {
      return 'حداکثر تعداد استفاده باید عددی مثبت یا خالی باشد.';
    }
    if (
      form.minPurchaseAmount !== '' &&
      (!Number.isInteger(Number(form.minPurchaseAmount)) || Number(form.minPurchaseAmount) < 0)
    ) {
      return 'حداقل مبلغ خرید باید عددی نامنفی باشد.';
    }
    if (form.purchasedFrom && form.purchasedTo) {
      if (new Date(form.purchasedFrom).getTime() > new Date(form.purchasedTo).getTime()) {
        return 'تاریخ شروع بازه خرید باید قبل از تاریخ پایان باشد.';
      }
    }
    // Purchase-total rule: both fields arrive together or neither does.
    if (form.purchaseTotalOperator !== '' || form.purchaseTotalAmount !== '') {
      if (form.purchaseTotalOperator === '' || form.purchaseTotalAmount === '') {
        return 'برای قاعده مجموع خرید قبلی، نوع مقایسه و مبلغ هر دو لازم است.';
      }
      if (
        !Number.isInteger(Number(form.purchaseTotalAmount)) ||
        Number(form.purchaseTotalAmount) < 0
      ) {
        return 'مبلغ مجموع خریدهای قبلی باید عددی نامنفی باشد.';
      }
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
      const response = await fetch(editing ? `/api/coupons/${editing.id}` : '/api/coupons', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          type: form.type,
          value: Number(form.value),
          isActive: form.isActive,
          // Expiry is stored as the picked day's end-of-day, local time.
          expiresAt: form.expiresAt ? `${dateKey(new Date(form.expiresAt))}T23:59:59` : null,
          maxUses: form.maxUses === '' ? null : Number(form.maxUses),
          customerId: form.customerId === '' ? null : form.customerId,
          productId: form.productId === '' ? null : form.productId,
          minPurchaseAmount: form.minPurchaseAmount === '' ? null : Number(form.minPurchaseAmount),
          categoryId: form.categoryId === '' ? null : form.categoryId,
          purchasedProductId: form.purchasedProductId === '' ? null : form.purchasedProductId,
          purchasedFrom: form.purchasedFrom === '' ? null : form.purchasedFrom,
          purchasedTo:
            form.purchasedTo === '' ? null : `${dateKey(new Date(form.purchasedTo))}T23:59:59`,
          purchaseTotalOperator:
            form.purchaseTotalOperator === '' ? null : form.purchaseTotalOperator,
          purchaseTotalAmount:
            form.purchaseTotalOperator === '' || form.purchaseTotalAmount === ''
              ? null
              : Number(form.purchaseTotalAmount),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setFormError(payload.error ?? 'ذخیره کد تخفیف ناموفق بود.');
        return;
      }

      notifications.show({
        title: editing ? 'کد تخفیف ویرایش شد' : 'کد تخفیف ساخته شد',
        message: form.code.trim().toUpperCase(),
        color: 'green',
        icon: <IconTicket size={16} />,
      });
      setModalOpened(false);
      router.refresh();
    } catch {
      setFormError('ارتباط با سرور برقرار نشد.');
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <>
      {canAdd ? (
        <Group justify="flex-end" mb="md">
          <Button size="sm" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            کد تخفیف جدید
          </Button>
        </Group>
      ) : null}

      {coupons.length === 0 ? (
        <Card withBorder padding="lg">
          <Stack gap={6} align="center" py="xl">
            <IconTicket size={36} stroke={1.2} />
            <Text size="sm" c="dimmed">
              هنوز کد تخفیفی ثبت نشده است.
            </Text>
          </Stack>
        </Card>
      ) : (
        <Table.ScrollContainer minWidth={960}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>کد</Table.Th>
                <Table.Th>نوع</Table.Th>
                <Table.Th>مقدار</Table.Th>
                <Table.Th>شرایط استفاده</Table.Th>
                <Table.Th>استفاده</Table.Th>
                <Table.Th>انقضا</Table.Th>
                {canEdit ? <Table.Th>فعال</Table.Th> : null}
                {canEdit ? <Table.Th /> : null}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {coupons.map((coupon) => {
                const chips = targetingChips(coupon);
                return (
                  <Table.Tr key={coupon.id}>
                    <Table.Td ff="monospace" fw={600}>
                      {coupon.code}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={coupon.type === 'percent' ? 'blue' : 'teal'}
                        radius="sm"
                        size="sm"
                      >
                        {coupon.type === 'percent' ? 'درصدی' : 'مبلغی'}
                      </Badge>
                    </Table.Td>
                    <Table.Td fw={600}>{valueLabel(coupon)}</Table.Td>
                    <Table.Td>
                      {chips.length > 0 ? (
                        <Stack gap={4}>
                          {chips.map((chip) => (
                            <Text key={chip.label} size="xs" lineClamp={1}>
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
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {faNumber(coupon.usedCount)}
                        {coupon.maxUses !== null ? ` / ${faNumber(coupon.maxUses)}` : ''}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text
                        size="sm"
                        c={
                          coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()
                            ? 'red'
                            : 'dimmed'
                        }
                      >
                        {expiryLabel(coupon)}
                      </Text>
                    </Table.Td>
                    {canEdit ? (
                      <Table.Td>
                        <Switch
                          aria-label={`فعال بودن ${coupon.code}`}
                          checked={coupon.isActive}
                          onChange={() => void handleToggle(coupon)}
                        />
                      </Table.Td>
                    ) : null}
                    {canEdit ? (
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Button
                            variant="light"
                            size="compact-xs"
                            onClick={() => openEdit(coupon)}
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
                      </Table.Td>
                    ) : null}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {/* Create / edit — the same modal for both. */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editing ? `ویرایش کد تخفیف ${editing.code}` : 'کد تخفیف جدید'}
        centered
        size="lg"
      >
        <Stack gap="sm">
          <TextInput
            label="کد"
            placeholder="مثلاً WELCOME10"
            required
            dir="ltr"
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.currentTarget.value })}
          />
          <Group gap="sm" grow>
            <Select
              label="نوع"
              data={[
                { value: 'percent', label: 'درصدی' },
                { value: 'fixed', label: 'مبلغی (تومان)' },
              ]}
              value={form.type}
              onChange={(value) =>
                setForm({ ...form, type: value === 'fixed' ? 'fixed' : 'percent' })
              }
            />
            <NumberInput
              label={form.type === 'percent' ? 'درصد تخفیف' : 'مبلغ تخفیف (تومان)'}
              placeholder={form.type === 'percent' ? 'مثلاً ۱۰' : 'مثلاً ۵۰۰۰۰۰'}
              min={0}
              max={form.type === 'percent' ? 100 : undefined}
              hideControls
              dir="ltr"
              value={form.value}
              onChange={(value) =>
                setForm({ ...form, value: typeof value === 'number' ? value : '' })
              }
            />
          </Group>
          <Group gap="sm" grow>
            <NumberInput
              label="حداکثر استفاده (اختیاری)"
              placeholder="بدون محدودیت"
              min={0}
              hideControls
              dir="ltr"
              value={form.maxUses}
              onChange={(value) =>
                setForm({ ...form, maxUses: typeof value === 'number' ? value : '' })
              }
            />
            {/* The form keeps ISO; the picker shows Jalali and returns ISO. */}
            <PersianDateTimePicker
              label="تاریخ انقضا (اختیاری)"
              description="خالی = بدون انقضا"
              dateFormat="numeric"
              showTime={false}
              clearable
              value={form.expiresAt || null}
              onChange={(next) => setForm({ ...form, expiresAt: pickerToIso(next) })}
            />
          </Group>
          <NumberInput
            label="حداقل مبلغ خرید (اختیاری)"
            description="سفارش باید حداقل این مبلغ را داشته باشد — خالی = بدون حد."
            placeholder="مثلاً ۱۰۰۰۰۰۰"
            min={0}
            hideControls
            dir="ltr"
            value={form.minPurchaseAmount}
            onChange={(value) =>
              setForm({ ...form, minPurchaseAmount: typeof value === 'number' ? value : '' })
            }
          />
          <Select
            label="مشتری اختصاصی (اختیاری)"
            description="خالی = قابل استفاده برای همه مشتریان"
            placeholder="همه مشتریان"
            data={customers.map((customer) => ({
              value: customer.id,
              label: `${customer.name} — ${customer.phone}`,
            }))}
            searchable
            clearable
            nothingFoundMessage="مشتری‌ای یافت نشد"
            value={form.customerId === '' ? null : form.customerId}
            onChange={(value) => setForm({ ...form, customerId: value ?? '' })}
          />
          <Group gap="sm" grow>
            <Select
              label="محصول یا دسته اختصاصی (اختیاری)"
              description="محصول: فقط خطوط همان محصول — دسته: همه کالاهای دسته."
              placeholder="کل سفارش"
              data={products.map((product) => ({ value: product.id, label: product.name }))}
              searchable
              clearable
              nothingFoundMessage="محصولی یافت نشد"
              value={form.productId === '' ? null : form.productId}
              onChange={(value) => setForm({ ...form, productId: value ?? '' })}
            />
            <Select
              label="دسته‌بندی (اختیاری)"
              description="خالی = بدون محدودیت دسته"
              placeholder="بدون محدودیت"
              data={categories.map((category) => ({
                value: category.id,
                label: category.label,
              }))}
              searchable
              clearable
              nothingFoundMessage="دسته‌ای یافت نشد"
              value={form.categoryId === '' ? null : form.categoryId}
              onChange={(value) => setForm({ ...form, categoryId: value ?? '' })}
            />
          </Group>
          <Select
            label="مخصوص خریدارانِ کالای… (اختیاری)"
            description="فقط مشتریانی که این کالا را در بازه زیر خریده‌اند می‌توانند استفاده کنند."
            placeholder="بدون شرط خرید قبلی"
            data={products.map((product) => ({ value: product.id, label: product.name }))}
            searchable
            clearable
            nothingFoundMessage="محصولی یافت نشد"
            value={form.purchasedProductId === '' ? null : form.purchasedProductId}
            onChange={(value) => setForm({ ...form, purchasedProductId: value ?? '' })}
          />
          <Group gap="sm" grow>
            <PersianDateTimePicker
              label="از تاریخ (اختیاری)"
              description="شروع بازه خرید قبلی"
              dateFormat="numeric"
              showTime={false}
              clearable
              value={form.purchasedFrom || null}
              onChange={(next) => setForm({ ...form, purchasedFrom: pickerToIso(next) })}
            />
            <PersianDateTimePicker
              label="تا تاریخ (اختیاری)"
              description="پایان بازه خرید قبلی"
              dateFormat="numeric"
              showTime={false}
              clearable
              value={form.purchasedTo || null}
              onChange={(next) => setForm({ ...form, purchasedTo: pickerToIso(next) })}
            />
          </Group>
          <Group gap="sm" grow>
            <Select
              label="مجموع خریدهای قبلی مشتری (اختیاری)"
              description="شرط روی مجموع مبلغ سفارش‌های پرداخت‌شده"
              data={[
                { value: 'gt', label: 'بیشتر از' },
                { value: 'lt', label: 'کمتر از' },
                { value: 'eq', label: 'برابر با' },
              ]}
              clearable
              placeholder="بدون شرط"
              value={form.purchaseTotalOperator === '' ? null : form.purchaseTotalOperator}
              onChange={(value) =>
                setForm({
                  ...form,
                  purchaseTotalOperator: (value ?? '') as '' | 'gt' | 'lt' | 'eq',
                })
              }
            />
            <NumberInput
              label="مبلغ مجموع خرید (تومان)"
              description="آستانه مقایسه — همراه نوع مقایسه"
              placeholder="مثلاً ۵۰۰۰۰۰۰"
              min={0}
              hideControls
              dir="ltr"
              disabled={form.purchaseTotalOperator === ''}
              value={form.purchaseTotalAmount}
              onChange={(value) =>
                setForm({
                  ...form,
                  purchaseTotalAmount: typeof value === 'number' ? value : '',
                })
              }
            />
          </Group>
          <Switch
            label="فعال"
            checked={form.isActive}
            onChange={(event) => setForm({ ...form, isActive: event.currentTarget.checked })}
          />
          {formError ? (
            <Text size="sm" c="red">
              {formError}
            </Text>
          ) : null}
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={() => setModalOpened(false)}>
              انصراف
            </Button>
            <Button loading={saving} onClick={handleSubmit}>
              {editing ? 'ذخیره تغییرات' : 'ساخت کد تخفیف'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete confirmation — never window.confirm (project convention). */}
      <Modal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف کد تخفیف"
        centered
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
      </Modal>
    </>
  );
}
