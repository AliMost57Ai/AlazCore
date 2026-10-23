'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Divider,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { PersianDateTimePicker } from '@/components/PersianDateTimePicker/PersianDateTimePicker';

export interface DomainFormRow {
  id: string;
  domain: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  techName: string;
  techPhone: string;
  techEmail: string;
  planId: string | null;
  planExpiresAt: string | null;
  isActive: boolean;
  status: string;
  notes: string;
  templateId: string | null;
  commissionPercent: number;
  oversellAllowed: boolean;
  oversellMax: number;
  inPersonDelivery: boolean;
}

export interface DomainFormProps {
  plans: { id: string; name: string }[];
  templates: { id: string; name: string; key: string }[];
  /** حق فعال/غیرفعال کردن خالی‌فروشی و تعیین سقف آن (قابلیت نقش Core). */
  canOversell: boolean;
  /** دامنه موجود در حالت ویرایش — null = ایجاد. */
  initial?: DomainFormRow | null;
}

interface FormState {
  domain: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  techName: string;
  techPhone: string;
  techEmail: string;
  planId: string;
  planExpiresAt: string;
  templateId: string;
  isActive: boolean;
  status: string;
  notes: string;
  commissionPercent: string;
  oversellAllowed: boolean;
  oversellMax: string;
  inPersonDelivery: boolean;
}

const EMPTY_FORM: FormState = {
  domain: '',
  ownerName: '',
  ownerPhone: '',
  ownerEmail: '',
  techName: '',
  techPhone: '',
  techEmail: '',
  planId: '',
  planExpiresAt: '',
  templateId: '',
  isActive: true,
  status: 'active',
  notes: '',
  commissionPercent: '0',
  oversellAllowed: false,
  oversellMax: '',
  inPersonDelivery: false,
};

/**
 * فرم تعریف/ویرایش دامنه — صفحات اختصاصی /panel/domains/new و …/[id]/edit
 * (فرم‌های بیش از ۴ فیلد مودال باز نمی‌شوند). همان API قبلی
 * (/api/domains)؛ تاریخ انقضا با PersianDateTimePicker (قرارداد پروژه).
 * فیلدهای خالی‌فروشی فقط با مجوز ارسال می‌شوند.
 */
export default function DomainForm({ plans, templates, canOversell, initial }: DomainFormProps) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          domain: initial.domain,
          ownerName: initial.ownerName,
          ownerPhone: initial.ownerPhone,
          ownerEmail: initial.ownerEmail,
          techName: initial.techName,
          techPhone: initial.techPhone,
          techEmail: initial.techEmail,
          planId: initial.planId ?? '',
          planExpiresAt: initial.planExpiresAt
            ? new Date(initial.planExpiresAt).toISOString().slice(0, 10)
            : '',
          templateId: initial.templateId ?? '',
          isActive: initial.isActive,
          status: initial.status,
          notes: initial.notes,
          commissionPercent: String(initial.commissionPercent ?? 0),
          oversellAllowed: initial.oversellAllowed,
          oversellMax: String(initial.oversellMax ?? 0),
          inPersonDelivery: initial.inPersonDelivery,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        planId: form.planId || null,
        templateId: form.templateId || null,
        planExpiresAt: form.planExpiresAt || null,
        commissionPercent: Number(form.commissionPercent) || 0,
        // فیلدهای خالی‌فروشی فقط با مجوز ارسال می‌شوند — بدون مجوز، تنظیم
        // موجود دامنه دست‌نخورده می‌ماند.
        ...(canOversell
          ? {
              oversellAllowed: form.oversellAllowed,
              oversellMax: Number(form.oversellMax) || 0,
            }
          : {}),
        inPersonDelivery: form.inPersonDelivery,
      };
      const response = await fetch(initial ? `/api/domains/${initial.id}` : '/api/domains', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) {
        notifications.show({ message: data.error ?? 'ذخیره ناموفق بود.', color: 'crimson' });
        return;
      }
      notifications.show({ message: 'دامنه ذخیره شد.', color: 'brand' });
      // بعد از ایجاد، به صفحه‌ی ویرایش برو — کارت «اطلاعات ورود فروشگاه» همان
      //‌جاست و اعتبارنامه‌ی ادمینِ تازه‌ساخته بلافاصله قابل مشاهده/کپی است.
      if (!initial && data.id) {
        router.push(`/panel/domains/${data.id}/edit`);
      } else {
        router.push('/panel/domains');
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          label="دامنه"
          placeholder="joghd.ir"
          dir="ltr"
          required
          value={form.domain}
          onChange={(e) => setForm({ ...form, domain: e.currentTarget.value })}
        />
        <PersianDateTimePicker
          label="اعتبار پلن تا (اختیاری)"
          value={form.planExpiresAt ? `${form.planExpiresAt}T00:00:00` : undefined}
          valueFormat="YYYY-MM-DD"
          dateFormat="numeric"
          showTime={false}
          clearable
          size="default"
          onChange={(date) =>
            setForm({ ...form, planExpiresAt: typeof date === 'string' ? date : '' })
          }
        />
      </SimpleGrid>

      <Divider label="مالک سایت" labelPosition="right" />
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <TextInput
          label="نام مالک"
          required
          value={form.ownerName}
          onChange={(e) => setForm({ ...form, ownerName: e.currentTarget.value })}
        />
        <TextInput
          label="موبایل مالک"
          dir="ltr"
          value={form.ownerPhone}
          onChange={(e) => setForm({ ...form, ownerPhone: e.currentTarget.value })}
        />
        <TextInput
          label="ایمیل مالک"
          dir="ltr"
          value={form.ownerEmail}
          onChange={(e) => setForm({ ...form, ownerEmail: e.currentTarget.value })}
        />
      </SimpleGrid>

      <Divider label="رابط فنی" labelPosition="right" />
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <TextInput
          label="نام رابط فنی"
          value={form.techName}
          onChange={(e) => setForm({ ...form, techName: e.currentTarget.value })}
        />
        <TextInput
          label="موبایل"
          dir="ltr"
          value={form.techPhone}
          onChange={(e) => setForm({ ...form, techPhone: e.currentTarget.value })}
        />
        <TextInput
          label="ایمیل"
          dir="ltr"
          value={form.techEmail}
          onChange={(e) => setForm({ ...form, techEmail: e.currentTarget.value })}
        />
      </SimpleGrid>

      <Divider label="پلن و تم" labelPosition="right" />
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Select
          label="پلن"
          placeholder="انتخاب پلن"
          data={plans.map((p) => ({ value: p.id, label: p.name }))}
          value={form.planId || null}
          onChange={(value) => setForm({ ...form, planId: value ?? '' })}
          clearable
        />
        <Select
          label="تم سایت"
          placeholder="تم پیش‌فرض سامانه"
          data={templates.map((t) => ({ value: t.id, label: t.name }))}
          value={form.templateId || null}
          onChange={(value) => setForm({ ...form, templateId: value ?? '' })}
          clearable
        />
      </SimpleGrid>

      <Textarea
        label="توضیحات"
        autosize
        minRows={2}
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })}
      />

      {canOversell ? (
        <>
          <Switch
            label="خالی‌فروشی مجاز"
            description="فروش کالای بدون موجودی تا سقف زیر"
            checked={form.oversellAllowed}
            onChange={(e) => setForm({ ...form, oversellAllowed: e.currentTarget.checked })}
          />
          <NumberInput
            label="حداکثر خالی‌فروشی مجاز (عدد)"
            description="سقف کل فروشگاه در همه کالاها"
            min={0}
            value={form.oversellMax}
            disabled={!form.oversellAllowed}
            onChange={(value) => setForm({ ...form, oversellMax: String(value ?? '') })}
          />
        </>
      ) : null}

      <Switch
        label="تحویل حضوری"
        description="خاموش = منوها و صفحات تحویل حضوری در داشبورد مالک نمایش داده نمی‌شود"
        checked={form.inPersonDelivery}
        onChange={(e) => setForm({ ...form, inPersonDelivery: e.currentTarget.checked })}
      />

      <NumberInput
        label="درصد پورسانت آلازکور"
        description="درصدی از فروش این سایت که درآمد شرکت محسوب می‌شود (۰ تا ۱۰۰)"
        min={0}
        max={100}
        value={form.commissionPercent}
        onChange={(value) => setForm({ ...form, commissionPercent: String(value ?? '') })}
      />

      <Group justify="space-between">
        <Switch
          label="فعال"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.currentTarget.checked })}
        />
        <Select
          label="وضعیت"
          data={[
            { value: 'active', label: 'فعال' },
            { value: 'suspended', label: 'معلق (تعلیق پشتیبانی)' },
          ]}
          value={form.status}
          onChange={(value) => setForm({ ...form, status: value ?? 'active' })}
          w={220}
        />
      </Group>

      <Group justify="end" mt="md">
        <Button variant="subtle" component={Link} href="/panel/domains">
          انصراف
        </Button>
        <Button loading={saving} onClick={save}>
          ذخیره دامنه
        </Button>
      </Group>
    </Stack>
  );
}
