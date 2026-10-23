'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconTicket } from '@tabler/icons-react';
import { Button, Group, NumberInput, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { PersianDateTimePicker } from '@/components/PersianDateTimePicker/PersianDateTimePicker';
import type { CouponDTO } from '@/lib/coupons';

/** The shape of the create/edit form values. */
interface CouponFormValues {
  code: string;
  type: 'percent' | 'fixed';
  value: number | '';
  maxUses: number | '';
  /** Local date string or '' — no expiry. */
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
  /** Purchase window bounds, local date or '' (unbounded). */
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

/**
 * فیلد تاریخ شمسی فرم کوپن — PersianDateTimePicker مستقیم (قرارداد پروژه)؛
 * مقدار فرم رشته YYYY-MM-DD است و تبدیل ISO در submit انجام می‌شود.
 */
function CouponDateField({
  label,
  description: _description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (date: string) => void;
}) {
  return (
    <PersianDateTimePicker
      label={label}
      value={value ? new Date(value) : undefined}
      valueFormat="YYYY-MM-DD"
      dateFormat="numeric"
      showTime={false}
      clearable
      size="default"
      onChange={(date) => onChange(typeof date === 'string' ? date : '')}
    />
  );
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

export interface CouponFormProps {
  /** Registered customers, for the assignment select. */
  customers: CouponCustomerOption[];
  /** Products, for the assignment/product selects. */
  products: CouponProductOption[];
  /** Groups + categories, for the category restriction select. */
  categories: CouponCategoryOption[];
  /** Existing coupon in edit mode — null/undefined = create. */
  initial?: CouponDTO | null;
}

/**
 * فرم ایجاد/ویرایش کد تخفیف — صفحات اختصاصی /coupons/new و /coupons/[id]/edit
 * (فرم‌های بیش از ۴ فیلد صفحه اختصاصی دارند، نه مودال). همان اعتبارسنجی و
 * همان API قبلی (/api/coupons)؛ پس از ذخیره به فهرست برمی‌گردد.
 */
export default function CouponForm({ customers, products, categories, initial }: CouponFormProps) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [form, setForm] = useState<CouponFormValues>(() =>
    initial
      ? {
          code: initial.code,
          type: initial.type,
          value: initial.value,
          maxUses: initial.maxUses ?? '',
          expiresAt: initial.expiresAt ?? '',
          isActive: initial.isActive,
          customerId: initial.customerId ?? '',
          productId: initial.productId ?? '',
          minPurchaseAmount: initial.minPurchaseAmount ?? '',
          categoryId: initial.categoryId ?? '',
          purchasedProductId: initial.purchasedProductId ?? '',
          purchasedFrom: initial.purchasedFrom ?? '',
          purchasedTo: initial.purchasedTo ?? '',
          purchaseTotalOperator: initial.purchaseTotalOperator ?? '',
          purchaseTotalAmount: initial.purchaseTotalAmount ?? '',
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      const response = await fetch(initial ? `/api/coupons/${initial.id}` : '/api/coupons', {
        method: initial ? 'PATCH' : 'POST',
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
      router.push('/coupons');
    } catch {
      setFormError('ارتباط با سرور برقرار نشد.');
    } finally {
      setSaving(false);
    }
  }

  return (
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
          onChange={(value) => setForm({ ...form, type: value === 'fixed' ? 'fixed' : 'percent' })}
        />
        <NumberInput
          label={form.type === 'percent' ? 'درصد تخفیف' : 'مبلغ تخفیف (تومان)'}
          placeholder={form.type === 'percent' ? 'مثلاً ۱۰' : 'مثلاً ۵۰۰۰۰۰'}
          min={0}
          max={form.type === 'percent' ? 100 : undefined}
          thousandSeparator={form.type === 'fixed' ? ',' : undefined}
          hideControls
          dir="ltr"
          value={form.value}
          onChange={(value) => setForm({ ...form, value: typeof value === 'number' ? value : '' })}
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
        <CouponDateField
          label="تاریخ انقضا (اختیاری)"
          description="خالی = بدون انقضا"
          value={form.expiresAt}
          onChange={(date) => setForm({ ...form, expiresAt: date })}
        />
      </Group>
      <NumberInput
        label="حداقل مبلغ خرید (اختیاری)"
        description="سفارش باید حداقل این مبلغ را داشته باشد — خالی = بدون حد."
        placeholder="مثلاً ۱۰۰۰۰۰۰"
        min={0}
        thousandSeparator=","
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
        <CouponDateField
          label="از تاریخ (اختیاری)"
          description="شروع بازه خرید قبلی"
          value={form.purchasedFrom}
          onChange={(date) => setForm({ ...form, purchasedFrom: date })}
        />
        <CouponDateField
          label="تا تاریخ (اختیاری)"
          description="پایان بازه خرید قبلی"
          value={form.purchasedTo}
          onChange={(date) => setForm({ ...form, purchasedTo: date })}
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
          thousandSeparator=","
          hideControls
          dir="ltr"
          disabled={form.purchaseTotalOperator === ''}
          value={form.purchaseTotalAmount}
          onChange={(value) =>
            setForm({ ...form, purchaseTotalAmount: typeof value === 'number' ? value : '' })
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
        <Button variant="subtle" component={Link} href="/coupons">
          انصراف
        </Button>
        <Button loading={saving} onClick={handleSubmit}>
          {editing ? 'ذخیره تغییرات' : 'ساخت کد تخفیف'}
        </Button>
      </Group>
    </Stack>
  );
}
