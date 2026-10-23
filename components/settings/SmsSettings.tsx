'use client';

import { useState } from 'react';
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import { Button, Card, Divider, Group, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import GatewayCredentialRow, {
  type GatewayRowField,
} from '@/components/settings/GatewayCredentialRow';
import { fromFaDigits } from '@/lib/format';
import type { AppSettings } from '@/lib/settings';

export interface SmsSettingsProps {
  initial: AppSettings;
}

/** The SMS panel credential fields (plain strings). */
type SmsTextField =
  | 'medianaApiKey'
  | 'medianaSendingNumber'
  | 'smsirApiKey'
  | 'smsirLineNumber'
  | 'melipayamakUsername'
  | 'melipayamakPassword'
  | 'melipayamakLineNumber'
  | 'farazsmsApiKey'
  | 'farazsmsLineNumber'
  | 'payamresanUsername'
  | 'payamresanPassword'
  | 'payamresanLineNumber';

interface PanelSection {
  value: string;
  title: string;
  fields: GatewayRowField[];
  note?: string;
}

const PANEL_SECTIONS: PanelSection[] = [
  {
    value: 'mediana',
    title: 'مدیانا (Mediana)',
    fields: [
      { name: 'medianaApiKey', placeholder: 'کلید API', password: true, flex: 4 },
      { name: 'medianaSendingNumber', placeholder: 'شماره خط ارسال (اختیاری)', flex: 3 },
    ],
    note: 'کلید از پنل مدیانا (بخش توسعه‌دهندگان). شماره خط خالی بماند تا از خط خدماتی (Informational) ارسال شود.',
  },
  {
    value: 'smsir',
    title: 'sms.ir',
    fields: [
      { name: 'smsirApiKey', placeholder: 'کلید API', password: true, flex: 3 },
      { name: 'smsirLineNumber', placeholder: 'خط ارسال، مثلاً 3000xxxxx', flex: 3 },
    ],
    note: 'برای ارسال با قالب (Verify Template)، کد قالب‌ها را در صفحه «الگوهای پیامکی» تنظیم کنید.',
  },
  {
    value: 'melipayamak',
    title: 'ملی‌پیامک (Melipayamak)',
    fields: [
      { name: 'melipayamakUsername', placeholder: 'نام کاربری', flex: 2 },
      { name: 'melipayamakPassword', placeholder: 'رمز عبور وبسرویس', password: true, flex: 3 },
      { name: 'melipayamakLineNumber', placeholder: 'خط ارسال', flex: 2 },
    ],
    note: 'رمز وبسرویس پنل (نه رمز ورود) — از بخش توسعه‌دهندگان ملی‌پیامک. این پنل ارسال متنی دارد؛ الگو ندارد.',
  },
  {
    value: 'farazsms',
    title: 'فراز اس‌ام‌اس (IPPanel / FarazSMS)',
    fields: [
      { name: 'farazsmsApiKey', placeholder: 'کلید API', password: true, flex: 3 },
      { name: 'farazsmsLineNumber', placeholder: 'خط ارسال (From Number)', flex: 3 },
    ],
    note: 'برای ارسال با الگوی پنل، کدهای الگو را در صفحه «الگوهای پیامکی» تنظیم کنید.',
  },
  {
    value: 'payamresan',
    title: 'پیام رسان (Payam-Resan)',
    fields: [
      { name: 'payamresanUsername', placeholder: 'نام کاربری', flex: 2 },
      { name: 'payamresanPassword', placeholder: 'رمز عبور', password: true, flex: 2 },
      { name: 'payamresanLineNumber', placeholder: 'خط ارسال', flex: 2 },
    ],
    note: 'پیام رسان در این قالب فقط ارسال متنی دارد؛ الگو ندارد.',
  },
];

/**
 * SMS panel configuration, edited by admins at تنظیمات → پنل پیامکی
 * (/settings/sms): one compact row per panel (label + joined inline
 * credential inputs + «پنل فعال» switch) after the SMS-panel sample layout —
 * exactly one row's switch is on, picking the panel that sends the order
 * SMS. Message texts and per-panel patterns live on the الگوهای پیامکی page.
 * Only the panel fields are submitted; other pages' stored values stay
 * intact.
 */
export default function SmsSettings({
  initial,
  allowedPanels,
}: SmsSettingsProps & { allowedPanels?: string[] | null }) {
  const [saving, setSaving] = useState(false);
  // '' in the stored settings means Mediana; here it's always a concrete id.
  const [activeSmsPanel, setActiveSmsPanel] = useState<string>(initial.activeSmsPanel || 'mediana');

  const form = useForm<Record<SmsTextField, string>>({
    mode: 'uncontrolled',
    initialValues: {
      medianaApiKey: initial.medianaApiKey,
      medianaSendingNumber: initial.medianaSendingNumber,
      smsirApiKey: initial.smsirApiKey,
      smsirLineNumber: initial.smsirLineNumber,
      melipayamakUsername: initial.melipayamakUsername,
      melipayamakPassword: initial.melipayamakPassword,
      melipayamakLineNumber: initial.melipayamakLineNumber,
      farazsmsApiKey: initial.farazsmsApiKey,
      farazsmsLineNumber: initial.farazsmsLineNumber,
      payamresanUsername: initial.payamresanUsername,
      payamresanPassword: initial.payamresanPassword,
      payamresanLineNumber: initial.payamresanLineNumber,
    },
    validate: {
      medianaSendingNumber: (value) =>
        value.trim() === '' || /^09\d{9}$/.test(fromFaDigits(value).trim())
          ? null
          : 'شماره خط ارسال باید با ۰۹ شروع شود و ۱۱ رقم باشد.',
    },
  });

  async function handleSubmit(values: Record<SmsTextField, string>) {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medianaApiKey: values.medianaApiKey,
          medianaSendingNumber: fromFaDigits(values.medianaSendingNumber).trim(),
          smsirApiKey: values.smsirApiKey,
          smsirLineNumber: values.smsirLineNumber.trim(),
          melipayamakUsername: values.melipayamakUsername.trim(),
          melipayamakPassword: values.melipayamakPassword,
          melipayamakLineNumber: values.melipayamakLineNumber.trim(),
          farazsmsApiKey: values.farazsmsApiKey,
          farazsmsLineNumber: values.farazsmsLineNumber.trim(),
          payamresanUsername: values.payamresanUsername.trim(),
          payamresanPassword: values.payamresanPassword,
          payamresanLineNumber: values.payamresanLineNumber.trim(),
          activeSmsPanel: activeSmsPanel === 'mediana' ? '' : activeSmsPanel,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'ذخیره تنظیمات ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }

      notifications.show({
        title: 'ذخیره شد',
        message: 'تنظیمات پنل‌های پیامک به‌روزرسانی شد.',
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
    } catch {
      notifications.show({
        title: 'خطا',
        message: 'ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <Stack gap="md">
        <Card withBorder padding="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              اطلاعات هر پنل را در ردیف همان پنل وارد کنید و با کلید «پنل فعال» — که فقط یکی از
              پنل‌ها می‌تواند روشن باشد — پنل ارسال را انتخاب کنید؛ پیامک‌های فاکتور و اطلاع‌رسانی
              سفارش از طریق همان پنل ارسال می‌شوند. متن پیامک‌ها و الگوهای پنل‌های دارای الگو در
              صفحه «الگوهای پیامکی» تنظیم می‌شوند. فیلدهای رمز با کلید چشم کنارشان قابل مشاهده‌اند.
            </Text>

            {PANEL_SECTIONS.filter(
              (section) => !allowedPanels || allowedPanels.includes(section.value)
            ).map((section) => (
              <GatewayCredentialRow
                key={section.value}
                label={section.title}
                fields={section.fields}
                inputProps={(name) =>
                  form.getInputProps(
                    name as keyof Record<SmsTextField, string>
                  ) as unknown as Record<string, unknown>
                }
                isSelected={activeSmsPanel === section.value}
                onSelect={(checked) => {
                  // Exactly one panel stays active — switching one on moves
                  // the single selection; the active one can't be turned off.
                  if (checked) {
                    setActiveSmsPanel(section.value);
                  }
                }}
                selectLabel="پنل فعال"
                extra={
                  <Stack gap={4} mt={2}>
                    {form.errors.medianaSendingNumber && section.value === 'mediana' ? (
                      <Text size="xs" c="red">
                        {form.errors.medianaSendingNumber}
                      </Text>
                    ) : null}
                    {section.note ? (
                      <Text size="xs" c="dimmed">
                        {section.note}
                      </Text>
                    ) : null}
                  </Stack>
                }
              />
            ))}
          </Stack>
        </Card>

        <Divider my={4} />

        <Group justify="flex-end">
          <Button type="submit" loading={saving}>
            ذخیره تنظیمات
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
