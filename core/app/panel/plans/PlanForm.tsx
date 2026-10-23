'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Checkbox,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

/** منوهای قابل‌واگذاری در پنل ادمین فروشگاه — هم‌نام با ASSIGNABLE_MENUS فروشگاه. */
const SHOP_MENUS: { group: string; items: { href: string; label: string }[] }[] = [
  {
    group: 'عملیات فروشگاه',
    items: [
      { href: '/orders', label: 'سفارش‌ها' },
      { href: '/customers', label: 'مشتریان' },
    ],
  },
  {
    group: 'کالا',
    items: [
      { href: '/products', label: 'محصولات' },
      { href: '/settings/categories', label: 'دسته‌بندی کالا' },
    ],
  },
  {
    group: 'مالی',
    items: [
      { href: '/coupons', label: 'کد تخفیف' },
      { href: '/accounting', label: 'حسابداری' },
      { href: '/payments', label: 'تراکنشهای درگاه' },
      { href: '/price-updates', label: 'به‌روزرسانی قیمت' },
    ],
  },
  {
    group: 'وبسایت',
    items: [
      { href: '/settings/theme', label: 'تنظیمات قالب' },
      { href: '/settings/site', label: 'مشخصات سایت' },
      { href: '/settings/meta', label: 'متادیتا' },
    ],
  },
];

export interface PlanFormRow {
  id: string;
  name: string;
  description: string;
  menus: string[];
  limits: Record<string, unknown>;
  isActive: boolean;
  durationDays: number | null;
  priceMonthly: number;
}

export interface PlanFormProps {
  /** پلن موجود در حالت ویرایش — null = ایجاد. */
  initial?: PlanFormRow | null;
}

interface FormState {
  name: string;
  description: string;
  menus: string[];
  maxProducts: string;
  durationDays: string;
  priceMonthly: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  name: '',
  description: '',
  menus: [],
  maxProducts: '',
  durationDays: '',
  priceMonthly: '',
  isActive: true,
};

/**
 * فرم تعریف/ویرایش پلن اشتراک — صفحات اختصاصی /panel/plans/new و
 * …/[id]/edit (فرم‌های بیش از ۴ فیلد مودال باز نمی‌شوند). همان API قبلی
 * (/api/plans)؛ پس از ذخیره به فهرست پلن‌ها برمی‌گردد.
 */
export default function PlanForm({ initial }: PlanFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          name: initial.name,
          description: initial.description,
          menus: initial.menus,
          maxProducts:
            typeof initial.limits.maxProducts === 'number'
              ? String(initial.limits.maxProducts)
              : '',
          durationDays: initial.durationDays ? String(initial.durationDays) : '',
          priceMonthly: initial.priceMonthly ? String(initial.priceMonthly) : '',
          isActive: initial.isActive,
        }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        menus: form.menus,
        limits: form.maxProducts ? { maxProducts: Number(form.maxProducts) } : {},
        durationDays: form.durationDays ? Number(form.durationDays) : null,
        priceMonthly: form.priceMonthly ? Number(form.priceMonthly) : 0,
        isActive: form.isActive,
      };
      const response = await fetch(initial ? `/api/plans/${initial.id}` : '/api/plans', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        notifications.show({ message: data.error ?? 'ذخیره ناموفق بود.', color: 'crimson' });
        return;
      }
      notifications.show({ message: 'پلن ذخیره شد.', color: 'brand' });
      router.push('/panel/plans');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          label="نام پلن"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
        />
        <NumberInput
          label="قیمت ماهانه (تومان)"
          min={0}
          thousandSeparator=","
          value={form.priceMonthly}
          onChange={(value) => setForm({ ...form, priceMonthly: String(value ?? '') })}
        />
      </SimpleGrid>
      <Textarea
        label="توضیحات"
        autosize
        minRows={2}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <NumberInput
          label="مدت اعتبار پیش‌فرض (روز)"
          description="خالی = نامحدود"
          min={1}
          value={form.durationDays}
          onChange={(value) => setForm({ ...form, durationDays: String(value ?? '') })}
        />
        <NumberInput
          label="سقف محصولات"
          description="خالی = نامحدود"
          min={1}
          value={form.maxProducts}
          onChange={(value) => setForm({ ...form, maxProducts: String(value ?? '') })}
        />
      </SimpleGrid>

      <Checkbox
        label="دسترسی کامل به همه منوها (معادل *)"
        checked={form.menus.includes('*')}
        onChange={(e) => setForm({ ...form, menus: e.currentTarget.checked ? ['*'] : [] })}
      />

      {!form.menus.includes('*') ? (
        <Stack gap="xs">
          {SHOP_MENUS.map((group) => (
            <div key={group.group}>
              <Text size="sm" fw={600} mb={4}>
                {group.group}
              </Text>
              <Group gap="md">
                {group.items.map((item) => (
                  <Checkbox
                    key={item.href}
                    label={item.label}
                    checked={form.menus.includes(item.href)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        menus: e.currentTarget.checked
                          ? [...form.menus, item.href]
                          : form.menus.filter((m) => m !== item.href),
                      })
                    }
                  />
                ))}
              </Group>
            </div>
          ))}
        </Stack>
      ) : null}

      <Switch
        label="پلن فعال (قابل تخصیص به دامین جدید)"
        checked={form.isActive}
        onChange={(e) => setForm({ ...form, isActive: e.currentTarget.checked })}
      />

      <Group justify="end" mt="md">
        <Button variant="subtle" component={Link} href="/panel/plans">
          انصراف
        </Button>
        <Button loading={saving} onClick={save}>
          ذخیره پلن
        </Button>
      </Group>
    </Stack>
  );
}
