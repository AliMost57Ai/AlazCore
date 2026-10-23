'use client';

import { useState } from 'react';
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import { Button, Card, Divider, Group, Stack, Switch, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import GatewayCredentialRow, {
  type GatewayRowField,
} from '@/components/settings/GatewayCredentialRow';
import type { SettingsGateway } from '@/components/settings/PaymentSettings';
import type { AppSettings } from '@/lib/settings';

export interface BnplSettingsProps {
  initial: AppSettings;
  /** All gateways (IPG + BNPL) with their configured state. */
  gateways: SettingsGateway[];
}

/** The BNPL credential fields (plain strings). */
type BnplTextField =
  | 'digipayUsername'
  | 'digipayPassword'
  | 'snapppayClientId'
  | 'snapppayClientSecret'
  | 'snapppayUsername'
  | 'snapppayPassword'
  | 'snapppayBaseUrl'
  | 'taraApiKey'
  | 'taraRequestUrl'
  | 'taraVerifyUrl'
  | 'vibeApiKey'
  | 'vibeInstallments'
  | 'keepaClientId'
  | 'keepaClientSecret'
  | 'keepaTerminalId'
  | 'minipayMerchantId'
  | 'fakherNationalCode'
  | 'fakherTerminalNumber';

interface BnplFormValues extends Record<BnplTextField, string> {
  digipaySandbox: boolean;
}

interface GatewaySection {
  value: string;
  title: string;
  fields: GatewayRowField[];
  note?: string;
}

const GATEWAY_SECTIONS: GatewaySection[] = [
  {
    value: 'digipay',
    title: 'دیجی‌پی (DigiPay)',
    fields: [
      { name: 'digipayUsername', placeholder: 'نام کاربری API', flex: 3 },
      { name: 'digipayPassword', placeholder: 'رمز عبور API', password: true, flex: 3 },
    ],
    note: 'مشتری در پرداخت سفارش می‌تواند دیجی‌پی را انتخاب کند؛ کسری موجودی کیف پول از طریق «خرید اعتباری» دیجی‌پی پرداخت و پس از تأیید، به کیف پول و همین سفارش تخصیص می‌یابد.',
  },
  {
    value: 'snapppay',
    title: 'اسنپ‌پی (SnappPay)',
    fields: [
      { name: 'snapppayClientId', placeholder: 'Client ID', flex: 3 },
      { name: 'snapppayClientSecret', placeholder: 'Client Secret', password: true, flex: 3 },
      { name: 'snapppayUsername', placeholder: 'نام کاربری', flex: 2 },
      { name: 'snapppayPassword', placeholder: 'رمز عبور', password: true, flex: 2 },
      { name: 'snapppayBaseUrl', placeholder: 'آدرس سرویس (اختیاری) https://…', flex: 4 },
    ],
    note: 'Client ID و Secret از پنل portal.snapppay.ir ← توسعه فنی ← دسترسی‌های فنی. آدرس سرویس خالی = آدرس پیش‌فرض عملیاتی.',
  },
  {
    value: 'tara',
    title: 'تارا (Tara)',
    fields: [
      { name: 'taraApiKey', placeholder: 'کلید API', password: true, flex: 3 },
      { name: 'taraRequestUrl', placeholder: 'آدرس ایجاد پرداخت https://…', flex: 4 },
      { name: 'taraVerifyUrl', placeholder: 'آدرس تأیید پرداخت https://…', flex: 4 },
    ],
    note: 'مستندات عمومی برای تارا منتشر نشده است؛ آدرس‌ها و کلید را طبق قرارداد فنی ارائه‌دهنده وارد کنید.',
  },
  {
    value: 'vibe',
    title: 'وایب (Vibe)',
    fields: [
      { name: 'vibeApiKey', placeholder: 'کلید API (X-API-Key)', password: true, flex: 4 },
      { name: 'vibeInstallments', placeholder: 'تعداد اقساط (پیش‌فرض ۳)', flex: 3 },
    ],
  },
  {
    value: 'keepa',
    title: 'کیپا (Keepa)',
    fields: [
      { name: 'keepaClientId', placeholder: 'Client ID', flex: 3 },
      { name: 'keepaClientSecret', placeholder: 'Client Secret', password: true, flex: 3 },
      { name: 'keepaTerminalId', placeholder: 'شناسه پایانه', flex: 2 },
    ],
  },
  {
    value: 'minipay',
    title: 'مینی‌پی (MiniPay)',
    fields: [{ name: 'minipayMerchantId', placeholder: 'شناسه پذیرنده', password: true, flex: 4 }],
  },
  {
    value: 'fakher',
    title: 'فاخر (FakherSep)',
    fields: [
      { name: 'fakherNationalCode', placeholder: 'کد ملی پذیرنده', flex: 3 },
      { name: 'fakherTerminalNumber', placeholder: 'شماره پایانه', flex: 2 },
    ],
    note: 'کد ملی ثبت‌شده در قرارداد فاخر سپ.',
  },
];

/**
 * BNPL gateway (درگاه اقساطی) configuration, edited by admins at
 * تنظیمات → درگاه اقساطی (/settings/bnpl): DigiPay, SnappPay, Tara, Vibe,
 * Keepa, MiniPay and Fakher — one compact row per gateway (label + joined
 * inline credential inputs + «فعال» switch) after the bank-gateway sample
 * layout. The active selection is shared with the درگاه پرداخت page: this
 * form submits the full activeGateways list, keeping the online gateways'
 * entries intact, so each page only toggles its own rows. A BNPL gateway can
 * never be the default — that switch only exists on the درگاه پرداخت page.
 */
export default function BnplSettings({
  initial,
  gateways,
  allowedBnpl,
}: BnplSettingsProps & { allowedBnpl?: string[] | null }) {
  const [saving, setSaving] = useState(false);

  const form = useForm<BnplFormValues>({
    mode: 'uncontrolled',
    initialValues: {
      digipayUsername: initial.digipayUsername,
      digipayPassword: initial.digipayPassword,
      digipaySandbox: initial.digipaySandbox,
      snapppayClientId: initial.snapppayClientId,
      snapppayClientSecret: initial.snapppayClientSecret,
      snapppayUsername: initial.snapppayUsername,
      snapppayPassword: initial.snapppayPassword,
      snapppayBaseUrl: initial.snapppayBaseUrl,
      taraApiKey: initial.taraApiKey,
      taraRequestUrl: initial.taraRequestUrl,
      taraVerifyUrl: initial.taraVerifyUrl,
      vibeApiKey: initial.vibeApiKey,
      vibeInstallments: initial.vibeInstallments,
      keepaClientId: initial.keepaClientId,
      keepaClientSecret: initial.keepaClientSecret,
      keepaTerminalId: initial.keepaTerminalId,
      minipayMerchantId: initial.minipayMerchantId,
      fakherNationalCode: initial.fakherNationalCode,
      fakherTerminalNumber: initial.fakherTerminalNumber,
    },
    validate: {
      snapppayBaseUrl: (value) =>
        value.trim() === '' || /^https:\/\/\S+$/i.test(value.trim())
          ? null
          : 'آدرس باید یک URL معتبر با https باشد.',
      taraRequestUrl: (value) =>
        value.trim() === '' || /^https:\/\/\S+$/i.test(value.trim())
          ? null
          : 'آدرس باید یک URL معتبر با https باشد.',
      taraVerifyUrl: (value) =>
        value.trim() === '' || /^https:\/\/\S+$/i.test(value.trim())
          ? null
          : 'آدرس باید یک URL معتبر با https باشد.',
      vibeInstallments: (value) =>
        value.trim() === '' || /^\d{1,2}$/.test(value.trim())
          ? null
          : 'تعداد اقساط باید یک عدد ۱ تا ۲ رقمی باشد.',
    },
  });

  // Shared with the درگاه پرداخت page — the full list is carried so toggling a
  // row here never drops the online gateways' active state. BNPL gateways can
  // never be the default (that stays on the درگاه پرداخت page), so this form
  // only clears a legacy BNPL default if one was stored before that rule.
  const [activeGateways, setActiveGateways] = useState<string[]>(initial.activeGateways);
  const legacyBnplDefault = gateways.some(
    (gateway) => gateway.kind === 'bnpl' && gateway.id === initial.defaultGateway
  );

  const readyById = new Map(gateways.map((gateway) => [gateway.id, gateway.ready]));

  function toggleActive(id: string, checked: boolean) {
    setActiveGateways((list) => {
      const without = list.filter((item) => item !== id);
      return checked ? [...without, id] : without;
    });
  }

  async function handleSubmit(values: BnplFormValues) {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digipayUsername: values.digipayUsername.trim(),
          digipayPassword: values.digipayPassword,
          digipaySandbox: values.digipaySandbox,
          snapppayClientId: values.snapppayClientId.trim(),
          snapppayClientSecret: values.snapppayClientSecret,
          snapppayUsername: values.snapppayUsername.trim(),
          snapppayPassword: values.snapppayPassword,
          snapppayBaseUrl: values.snapppayBaseUrl.trim(),
          taraApiKey: values.taraApiKey,
          taraRequestUrl: values.taraRequestUrl.trim(),
          taraVerifyUrl: values.taraVerifyUrl.trim(),
          vibeApiKey: values.vibeApiKey,
          vibeInstallments: values.vibeInstallments.trim(),
          keepaClientId: values.keepaClientId.trim(),
          keepaClientSecret: values.keepaClientSecret,
          keepaTerminalId: values.keepaTerminalId.trim(),
          minipayMerchantId: values.minipayMerchantId,
          fakherNationalCode: values.fakherNationalCode.trim(),
          fakherTerminalNumber: values.fakherTerminalNumber.trim(),
          activeGateways,
          ...(legacyBnplDefault ? { defaultGateway: '' } : {}),
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
        message: 'تنظیمات درگاه‌های اقساطی به‌روزرسانی شد.',
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
              اطلاعات هر درگاه اقساطی را در ردیف همان درگاه وارد کنید و با کلید «فعال» مشخص کنید
              کدام درگاه‌های اقساطی در پرداخت سفارش نمایش داده شوند (درگاه‌های پرداخت آنلاین در صفحه
              «درگاه پرداخت» فعال می‌شوند). درگاه اقساطی نمی‌تواند پیش‌فرض باشد — پیش‌فرض فقط از
              میان درگاه‌های آنلاین در صفحه «درگاه پرداخت» انتخاب می‌شود.
            </Text>

            {GATEWAY_SECTIONS.filter(
              (section) => !allowedBnpl || allowedBnpl.includes(section.value)
            ).map((section) => (
              <GatewayCredentialRow
                key={section.value}
                label={section.title}
                fields={section.fields}
                inputProps={(name) =>
                  form.getInputProps(name as keyof BnplFormValues) as unknown as Record<
                    string,
                    unknown
                  >
                }
                isActive={activeGateways.includes(section.value)}
                onActiveChange={(checked) => toggleActive(section.value, checked)}
                configured={readyById.get(section.value)}
                extra={
                  <Stack gap={4} mt={2}>
                    {section.value === 'digipay' ? (
                      <Switch
                        size="xs"
                        label="حالت آزمایشی (Staging)"
                        description="درخواست‌ها به uat.mydigipay.info ارسال می‌شوند و پول واقعی جابه‌جا نمی‌شود."
                        key={form.key('digipaySandbox')}
                        {...form.getInputProps('digipaySandbox', { type: 'checkbox' })}
                      />
                    ) : null}
                    {section.fields.some((field) => form.errors[field.name]) ? (
                      <Text size="xs" c="red">
                        {form.errors[section.fields.find((field) => form.errors[field.name])!.name]}
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
