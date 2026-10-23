'use client';

import { useState } from 'react';
import { IconAlertCircle, IconCircleCheck, IconWorldWww } from '@tabler/icons-react';
import { Button, Card, Divider, Group, Stack, Switch, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import GatewayCredentialRow, {
  type GatewayRowField,
} from '@/components/settings/GatewayCredentialRow';
import type { AppSettings } from '@/lib/settings';

/** One gateway option for the active/default selectors (plain data). */
export interface SettingsGateway {
  id: string;
  label: string;
  kind: 'ipg' | 'bnpl';
  /** Whether the admin has entered this gateway's credentials. */
  ready: boolean;
}

export interface PaymentSettingsProps {
  initial: AppSettings;
  /** All gateways (IPG + BNPL) with their configured state. */
  gateways: SettingsGateway[];
}

/** The IPG credential fields (plain strings). */
type IpgTextField =
  | 'zarinpalMerchantId'
  | 'idpayApiKey'
  | 'parsianPin'
  | 'mellatTerminalId'
  | 'mellatUsername'
  | 'mellatPassword'
  | 'samanTerminalId'
  | 'sadadMerchantId'
  | 'sadadTerminalId'
  | 'sadadTerminalKey'
  | 'sepahMerchantId'
  | 'sepahTerminalId'
  | 'sepahPassword'
  | 'sizpayMerchantId'
  | 'sizpayTerminalId'
  | 'sizpaySecretKey1'
  | 'sizpaySecretKey2'
  | 'sizpayDigitalSign'
  | 'pasargadUsername'
  | 'pasargadPassword'
  | 'pasargadTerminalCode';

interface IpgFormValues extends Record<IpgTextField, string> {
  zarinpalSandbox: boolean;
  idpaySandbox: boolean;
}

interface GatewaySection {
  value: string;
  title: string;
  fields: GatewayRowField[];
  note?: string;
}

const GATEWAY_SECTIONS: GatewaySection[] = [
  {
    value: 'zarinpal',
    title: 'زرین‌پال (ZarinPal)',
    fields: [{ name: 'zarinpalMerchantId', placeholder: 'کلید فروشندگی', flex: 4 }],
    note: 'شناسه ۳۶ نویسه‌ای از پنل زرین‌پال. تا وقتی خالی باشد، این درگاه در پرداخت نمایش داده نمی‌شود.',
  },
  {
    value: 'idpay',
    title: 'آیدی‌پی (IdPay)',
    fields: [{ name: 'idpayApiKey', placeholder: 'کلید API', password: true, flex: 4 }],
    note: 'از پنل آیدی‌پی (بخش وب‌سرویس‌ها).',
  },
  {
    value: 'parsian',
    title: 'پارسیان (Parsian)',
    fields: [{ name: 'parsianPin', placeholder: 'شناسه پین', password: true, flex: 4 }],
    note: 'از پنل پذیرندگان پارسیان (پارسیان کارت).',
  },
  {
    value: 'mellat',
    title: 'ملت (Mellat)',
    fields: [
      { name: 'mellatTerminalId', placeholder: 'کد ترمینال', flex: 2 },
      { name: 'mellatUsername', placeholder: 'نام کاربری', flex: 2 },
      { name: 'mellatPassword', placeholder: 'رمز عبور', password: true, flex: 2 },
    ],
  },
  {
    value: 'saman',
    title: 'سامان (SEP / Saman)',
    fields: [{ name: 'samanTerminalId', placeholder: 'کد ترمینال', flex: 4 }],
    note: 'از پنل پذیرندگان سامان (سامان کیش).',
  },
  {
    value: 'sadad',
    title: 'سداد (Sadad)',
    fields: [
      { name: 'sadadMerchantId', placeholder: 'شماره پذیرنده', flex: 2 },
      { name: 'sadadTerminalId', placeholder: 'کد ترمینال', flex: 2 },
      { name: 'sadadTerminalKey', placeholder: 'کلید درگاه', password: true, flex: 3 },
    ],
  },
  {
    value: 'sepah',
    title: 'سپه — امیدپی (Sepah / OmidPayment)',
    fields: [
      { name: 'sepahMerchantId', placeholder: 'کد پذیرنده', flex: 2 },
      { name: 'sepahTerminalId', placeholder: 'کد ترمینال', flex: 2 },
      { name: 'sepahPassword', placeholder: 'رمز عبور', password: true, flex: 2 },
    ],
  },
  {
    value: 'sizpay',
    title: 'سیزپی (SizPay)',
    fields: [
      { name: 'sizpayMerchantId', placeholder: 'کد پذیرنده', flex: 2 },
      { name: 'sizpayTerminalId', placeholder: 'کد ترمینال', flex: 2 },
      { name: 'sizpaySecretKey1', placeholder: 'کلید ۱', password: true, flex: 3 },
      { name: 'sizpaySecretKey2', placeholder: 'کلید ۲', password: true, flex: 3 },
      { name: 'sizpayDigitalSign', placeholder: 'کلید امضا', password: true, flex: 3 },
    ],
  },
  {
    value: 'pasargad',
    title: 'پاسارگاد (Pasargad)',
    fields: [
      { name: 'pasargadUsername', placeholder: 'نام کاربری', flex: 2 },
      { name: 'pasargadPassword', placeholder: 'رمز عبور', password: true, flex: 2 },
      { name: 'pasargadTerminalCode', placeholder: 'کد پایانه', flex: 2 },
    ],
  },
];

/**
 * Online payment gateway (IPG) configuration, edited by admins at
 * تنظیمات → درگاه پرداخت (/settings/payment). Every gateway is one compact
 * row (label + joined inline credential inputs + «پیش‌فرض» switch + «فعال»
 * switch) after the bank-gateway sample layout; the shop-wide selection is
 * made right on each row — only one of the online gateways can carry the
 * default switch. Only the IPG fields and the selection are submitted; other
 * pages' stored values stay intact.
 */
export default function PaymentSettings({ initial, gateways }: PaymentSettingsProps) {
  const [saving, setSaving] = useState(false);

  const form = useForm<IpgFormValues>({
    mode: 'uncontrolled',
    initialValues: {
      zarinpalMerchantId: initial.zarinpalMerchantId,
      zarinpalSandbox: initial.zarinpalSandbox,
      idpayApiKey: initial.idpayApiKey,
      idpaySandbox: initial.idpaySandbox,
      parsianPin: initial.parsianPin,
      mellatTerminalId: initial.mellatTerminalId,
      mellatUsername: initial.mellatUsername,
      mellatPassword: initial.mellatPassword,
      samanTerminalId: initial.samanTerminalId,
      sadadMerchantId: initial.sadadMerchantId,
      sadadTerminalId: initial.sadadTerminalId,
      sadadTerminalKey: initial.sadadTerminalKey,
      sepahMerchantId: initial.sepahMerchantId,
      sepahTerminalId: initial.sepahTerminalId,
      sepahPassword: initial.sepahPassword,
      sizpayMerchantId: initial.sizpayMerchantId,
      sizpayTerminalId: initial.sizpayTerminalId,
      sizpaySecretKey1: initial.sizpaySecretKey1,
      sizpaySecretKey2: initial.sizpaySecretKey2,
      sizpayDigitalSign: initial.sizpayDigitalSign,
      pasargadUsername: initial.pasargadUsername,
      pasargadPassword: initial.pasargadPassword,
      pasargadTerminalCode: initial.pasargadTerminalCode,
    },
  });

  // The shop-wide gateway selection: multiple active gateways (online +
  // BNPL — this page's rows toggle the online ones), one default preselected
  // at checkout. An empty active list means "every configured gateway".
  const [activeGateways, setActiveGateways] = useState<string[]>(initial.activeGateways);
  const [defaultGateway, setDefaultGateway] = useState<string>(initial.defaultGateway);

  const readyById = new Map(gateways.map((gateway) => [gateway.id, gateway.ready]));

  function toggleActive(id: string, checked: boolean) {
    setActiveGateways((list) => {
      const without = list.filter((item) => item !== id);
      return checked ? [...without, id] : without;
    });
  }

  function toggleDefault(id: string, checked: boolean) {
    // Single-select: only one online gateway can be the default at a time.
    setDefaultGateway(checked ? id : '');
  }

  async function handleSubmit(values: IpgFormValues) {
    if (defaultGateway && activeGateways.length > 0 && !activeGateways.includes(defaultGateway)) {
      notifications.show({
        title: 'خطا',
        message: 'درگاه پیش‌فرض باید یکی از درگاه‌های فعال باشد.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zarinpalMerchantId: values.zarinpalMerchantId.trim(),
          zarinpalSandbox: values.zarinpalSandbox,
          idpayApiKey: values.idpayApiKey,
          idpaySandbox: values.idpaySandbox,
          parsianPin: values.parsianPin,
          mellatTerminalId: values.mellatTerminalId.trim(),
          mellatUsername: values.mellatUsername.trim(),
          mellatPassword: values.mellatPassword,
          samanTerminalId: values.samanTerminalId.trim(),
          sadadMerchantId: values.sadadMerchantId.trim(),
          sadadTerminalId: values.sadadTerminalId.trim(),
          sadadTerminalKey: values.sadadTerminalKey,
          sepahMerchantId: values.sepahMerchantId.trim(),
          sepahTerminalId: values.sepahTerminalId.trim(),
          sepahPassword: values.sepahPassword,
          sizpayMerchantId: values.sizpayMerchantId.trim(),
          sizpayTerminalId: values.sizpayTerminalId.trim(),
          sizpaySecretKey1: values.sizpaySecretKey1,
          sizpaySecretKey2: values.sizpaySecretKey2,
          sizpayDigitalSign: values.sizpayDigitalSign,
          pasargadUsername: values.pasargadUsername.trim(),
          pasargadPassword: values.pasargadPassword,
          pasargadTerminalCode: values.pasargadTerminalCode.trim(),
          activeGateways,
          defaultGateway,
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
        message: 'تنظیمات درگاه‌های پرداخت به‌روزرسانی شد.',
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
              اطلاعات هر درگاه را در ردیف همان درگاه وارد کنید. کلید «فعال» مشخص می‌کند کدام
              درگاه‌ها در پرداخت سفارش نمایش داده شوند (درگاه‌های اقساطی در صفحه «درگاه اقساطی» فعال
              می‌شوند) و کلید «پیش‌فرض» — که فقط یکی از درگاه‌های آنلاین می‌تواند روشن باشد — درگاهی
              است که از ابتدا در پرداخت انتخاب شده است. اگر هیچ درگاهی فعال نباشد، همه درگاه‌های
              پیکربندی‌شده نمایش داده می‌شوند.
            </Text>

            {GATEWAY_SECTIONS.map((section) => (
              <GatewayCredentialRow
                key={section.value}
                label={section.title}
                fields={section.fields}
                inputProps={(name) =>
                  form.getInputProps(name as keyof IpgFormValues) as unknown as Record<
                    string,
                    unknown
                  >
                }
                isSelected={defaultGateway === section.value}
                onSelect={(checked) => toggleDefault(section.value, checked)}
                selectLabel="درگاه پیش‌فرض"
                isActive={activeGateways.includes(section.value)}
                onActiveChange={(checked) => toggleActive(section.value, checked)}
                configured={readyById.get(section.value)}
                extra={
                  <Stack gap={4} mt={2}>
                    {section.value === 'zarinpal' ? (
                      <Switch
                        size="xs"
                        label="حالت آزمایشی (Sandbox)"
                        description="پرداخت‌ها از طریق sandbox.zarinpal.com انجام می‌شوند و پول واقعی جابه‌جا نمی‌شود."
                        key={form.key('zarinpalSandbox')}
                        {...form.getInputProps('zarinpalSandbox', { type: 'checkbox' })}
                      />
                    ) : null}
                    {section.value === 'idpay' ? (
                      <Switch
                        size="xs"
                        label="حالت آزمایشی (Sandbox)"
                        description="درخواست‌ها با هدر X-SANDBOX ارسال می‌شوند و پول واقعی جابه‌جا نمی‌شود."
                        key={form.key('idpaySandbox')}
                        {...form.getInputProps('idpaySandbox', { type: 'checkbox' })}
                      />
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

        <Card withBorder padding="md">
          <Group gap="xs" c="dimmed" mb="xs">
            <IconWorldWww size={16} />
            <Text size="sm" fw={600}>
              اتصال به ترب (Torob)
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            آدرس فید محصولات فروشگاه برای پنل فروشندگان ترب (torob.com/sell):
            <Text component="code" size="xs" dir="ltr" display="block" my={4}>
              /api/torob/feed
            </Text>
            این فید به‌صورت خودکار همه کالاهای موجود و قابل نمایش را به فرمت XML ترب (قیمت به ریال،
            وضعیت موجودی و لینک صفحه کالا) تبدیل می‌کند و نیازی به تنظیم اضافه ندارد — کافی است آدرس
            کامل آن را در پنل فروشندگان ترب ثبت کنید.
          </Text>
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
