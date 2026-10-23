'use client';

import { useState } from 'react';
import {
  IconAlertCircle,
  IconCheck,
  IconCircleCheck,
  IconCopy,
  IconCreditCard,
  IconKey,
  IconLink,
  IconMessage2,
  IconPlus,
  IconTrash,
  IconTruck,
} from '@tabler/icons-react';
import {
  Accordion,
  ActionIcon,
  Button,
  Card,
  Code,
  Divider,
  Grid,
  GridCol,
  Group,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm, type UseFormReturnType } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import type { AppSettings } from '@/lib/settings';
import {
  renderSmsTemplate,
  SAMPLE_SMS_VALUES,
  SMS_PLACEHOLDERS,
  type SmsPatternParam,
} from '@/lib/sms-template';

export interface SmsTemplatesProps {
  initial: AppSettings;
}

/** One pattern kind of a panel: { enabled, code, params }. */
interface PatternKindValues {
  enabled: boolean;
  code: string;
  params: SmsPatternParam[];
}

interface SmsTemplatesFormValues {
  smsFactorEnabled: boolean;
  smsTemplate: string;
  smsNoticeEnabled: boolean;
  smsNoticeTemplate: string;
  paymentLinkSmsEnabled: boolean;
  paymentLinkSmsTemplate: string;
  paymentLinkUsePattern: boolean;
  medianaPaymentLinkPatternCode: string;
  medianaPaymentLinkPatternParams: SmsPatternParam[];
  otpSmsEnabled: boolean;
  otpSmsTemplate: string;
  smsUsePattern: boolean;
  medianaPatternCode: string;
  medianaPatternParams: SmsPatternParam[];
  smsNoticeUsePattern: boolean;
  medianaNoticePatternCode: string;
  medianaNoticePatternParams: SmsPatternParam[];
  medianaOtpUsePattern: boolean;
  medianaOtpPatternCode: string;
  medianaOtpPatternParams: SmsPatternParam[];
  smsirPatternConfig: {
    factor: PatternKindValues;
    notice: PatternKindValues;
    otp: PatternKindValues;
    payment_link: PatternKindValues;
  };
  farazPatternConfig: {
    factor: PatternKindValues;
    notice: PatternKindValues;
    otp: PatternKindValues;
    payment_link: PatternKindValues;
  };
}

type TemplatesForm = UseFormReturnType<
  SmsTemplatesFormValues,
  (values: SmsTemplatesFormValues) => SmsTemplatesFormValues
>;

/** One «کپی» chip of a placeholder token (the sample's copyToMemory button). */
function CopyTokenButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. plain http) — ignore; the token is shown.
    }
  }

  return (
    <ActionIcon
      size="sm"
      variant="light"
      color="brand"
      aria-label={`کپی ${token}`}
      onClick={() => void copy()}
    >
      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
    </ActionIcon>
  );
}

/**
 * The «الگوها» card of the sample: one row per placeholder — its Persian
 * description on the right, the token plus a copy button on the left.
 */
function PatternTokenTable({ tokens }: { tokens: string[] }) {
  const rows = SMS_PLACEHOLDERS.filter((placeholder) => tokens.includes(placeholder.token));

  return (
    <Card withBorder padding="sm" ml={{ base: 0, sm: 'md' }}>
      <Text size="sm" fw={600} mb="xs">
        الگوها
      </Text>
      <Table verticalSpacing="xs" style={{ tableLayout: 'fixed' }}>
        <Table.Tbody>
          {rows.map((placeholder) => (
            <Table.Tr key={placeholder.token}>
              <Table.Td>
                <Text size="xs">{placeholder.label}</Text>
              </Table.Td>
              <Table.Td>
                <Group gap="xs" wrap="nowrap" justify="flex-end">
                  <CopyTokenButton token={placeholder.token} />
                  <Code dir="ltr">{placeholder.token}</Code>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

/** Rendered sample of a template for the live preview. */
function TemplatePreview({ template }: { template: string }) {
  return (
    <Stack gap={4}>
      <Text size="xs" fw={500}>
        پیش‌نمایش با داده نمونه:
      </Text>
      <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
        {renderSmsTemplate(template, SAMPLE_SMS_VALUES)}
      </Text>
    </Stack>
  );
}

/** Reads a dynamic list path off the uncontrolled form's current values. */
function listValues(form: TemplatesForm, path: string): SmsPatternParam[] {
  return (form.values as unknown as Record<string, SmsPatternParam[]>)[path] ?? [];
}

/** Dynamic parameter rows of one pattern config. */
function PatternParamsEditor({
  form,
  paramsPath,
  enabled,
  keyPlaceholder,
}: {
  form: TemplatesForm;
  paramsPath: string;
  enabled: boolean;
  keyPlaceholder: string;
}) {
  const params = listValues(form, paramsPath);

  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text size="sm" fw={500}>
            پارامترهای پترن
          </Text>
          <Text size="xs" c="dimmed">
            هر پارامتر الگو را به یکی از مقادیر فاکتور وصل کنید.
          </Text>
        </div>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          disabled={!enabled}
          onClick={() => form.insertListItem(paramsPath, { key: '', value: '{tracking}' })}
        >
          افزودن پارامتر
        </Button>
      </Group>

      {enabled ? (
        params.length > 0 ? (
          <Stack gap="xs">
            {params.map((_, index) => (
              <Group key={index} gap="xs" grow>
                <TextInput
                  placeholder={keyPlaceholder}
                  dir="ltr"
                  key={form.key(`${paramsPath}.${index}.key`)}
                  {...form.getInputProps(`${paramsPath}.${index}.key`)}
                />
                <TextInput
                  placeholder="مقدار، مثلاً {tracking}"
                  key={form.key(`${paramsPath}.${index}.value`)}
                  {...form.getInputProps(`${paramsPath}.${index}.value`)}
                />
                <ActionIcon
                  color="red"
                  variant="light"
                  aria-label="حذف پارامتر"
                  onClick={() => form.removeListItem(paramsPath, index)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        ) : (
          <Text size="xs" c="dimmed">
            هنوز پارامتری اضافه نشده است — «افزودن پارامتر» را بزنید.
          </Text>
        )
      ) : (
        <Text size="xs" c="dimmed">
          برای تعریف پارامترها، ابتدا ارسال با الگو را فعال کنید.
        </Text>
      )}
    </Stack>
  );
}

interface PatternSetupSectionProps {
  form: TemplatesForm;
  /** Full form paths of this panel+kind's config. */
  enabledPath: string;
  codePath: string;
  paramsPath: string;
  /** Watched live value of the enabled switch. */
  enabled: boolean;
  codeLabel: string;
  codeDescription: string;
  keyPlaceholder: string;
  switchDescription: string;
}

/**
 * The shared pattern setup — the user asked for one common structure because
 * «روش ساخت پترن پنل‌های پیامکی تقریباً شبیه همه»: every panel that supports
 * patterns (Mediana, sms.ir, FarazSMS) is configured the exact same way —
 * enable the pattern, enter the panel's pattern/template code, then map each
 * pattern parameter to an invoice value.
 */
function PatternSetupSection({
  form,
  enabledPath,
  codePath,
  paramsPath,
  enabled,
  codeLabel,
  codeDescription,
  keyPlaceholder,
  switchDescription,
}: PatternSetupSectionProps) {
  return (
    <Stack gap="sm">
      <Switch
        label="فعال‌سازی ارسال با پترن"
        description={switchDescription}
        key={form.key(enabledPath)}
        {...form.getInputProps(enabledPath, { type: 'checkbox' })}
      />
      <TextInput
        label={codeLabel}
        description={codeDescription}
        placeholder="pattern-code"
        dir="ltr"
        disabled={!enabled}
        key={form.key(codePath)}
        {...form.getInputProps(codePath)}
      />
      <PatternParamsEditor
        form={form}
        paramsPath={paramsPath}
        enabled={enabled}
        keyPlaceholder={keyPlaceholder}
      />
    </Stack>
  );
}

interface PatternTabsProps {
  /** One tab's content: the PatternSetupSection for one panel. */
  mediana: React.ReactNode;
  smsir: React.ReactNode;
  faraz: React.ReactNode;
}

/** Per-panel tabs of the «ارسال با الگو» section — one tab per SMS panel. */
function PatternTabs({ mediana, smsir, faraz }: PatternTabsProps) {
  return (
    <Tabs variant="default" defaultValue="mediana">
      <Tabs.List grow>
        <Tabs.Tab value="mediana" fz="xs">
          مدیانا
        </Tabs.Tab>
        <Tabs.Tab value="smsir" fz="xs">
          sms.ir
        </Tabs.Tab>
        <Tabs.Tab value="faraz" fz="xs">
          فراز اس‌ام‌اس
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="mediana" pt="sm">
        {mediana}
      </Tabs.Panel>
      <Tabs.Panel value="smsir" pt="sm">
        {smsir}
      </Tabs.Panel>
      <Tabs.Panel value="faraz" pt="sm">
        {faraz}
      </Tabs.Panel>
    </Tabs>
  );
}

/** The sample's «وضعیت — الگو فعال است؟» header switch of one message kind. */
function TemplateEnableSwitch({
  form,
  path,
  warning,
}: {
  form: TemplatesForm;
  path: string;
  warning?: string;
}) {
  return (
    <Switch
      label="الگو فعال است؟"
      description={warning}
      key={form.key(path)}
      {...form.getInputProps(path, { type: 'checkbox' })}
    />
  );
}

/**
 * One collapsible message-kind group, laid out like the sample page
 * (الگوهای واتساپ.html): the icon+title row doubles as the toggle, and the
 * panel opens with the sample's header form — a disabled «عنوان الگو» input
 * plus the «الگو فعال است؟» switch — above the two-column body (template
 * textarea + the «الگوها» variables card).
 */
function KindAccordion({
  icon,
  title,
  templateTitle,
  enableSwitch,
  defaultOpen = true,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  /** The sample's disabled «عنوان الگو» field value (shown, not editable). */
  templateTitle: string;
  /** The «الگو فعال است؟» switch (form-bound, per message kind). */
  enableSwitch: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Accordion defaultValue={defaultOpen ? ['open'] : []} multiple chevronPosition="left">
      <Accordion.Item value="open">
        <Card withBorder padding={0} style={{ overflow: 'hidden' }}>
          <Accordion.Control py="sm">
            <Group gap="xs" wrap="nowrap">
              {icon}
              <div>
                <Text size="sm" fw={600}>
                  {title}
                </Text>
              </div>
            </Group>
          </Accordion.Control>
          <Accordion.Panel p="md" pt={0}>
            <Stack gap="md">
              <Grid gutter="md">
                <GridCol span={{ base: 12, sm: 7 }}>
                  <TextInput label="عنوان الگو" value={templateTitle} disabled />
                </GridCol>
                <GridCol span={{ base: 12, sm: 5 }}>{enableSwitch}</GridCol>
              </Grid>
              {children}
            </Stack>
          </Accordion.Panel>
        </Card>
      </Accordion.Item>
    </Accordion>
  );
}

/**
 * The SMS template center, edited by admins at تنظیمات → الگوهای پیامکی
 * (/settings/sms-templates) — laid out like the admin's sample page
 * (الگوهای واتساپ.html): one collapsible card per message kind (factor,
 * shipping notice, payment link, login OTP), each opening with the sample's
 * header form (a disabled «عنوان الگو» input + the «الگو فعال است؟» switch
 * that gates whether that SMS is sent at all), then the free-text
 * «الگوی پیام متنی» with a live preview beside the «الگوها» placeholder
 * table with copy buttons; every card also carries the per-panel pattern
 * setups (Mediana, sms.ir, FarazSMS) as one tab per panel inside the
 * «ارسال با الگو» section. The site-wide sign-in policy lives on the
 * امنیت سامانه page. Only these fields are submitted; panel credentials
 * live on the پنل پیامکی page.
 */
export default function SmsTemplates({ initial }: SmsTemplatesProps) {
  const [saving, setSaving] = useState(false);

  const kind = (config: AppSettings['smsirPatternConfig']['factor']): PatternKindValues => ({
    enabled: config.enabled,
    code: config.code,
    params: config.params.map((param) => ({ ...param })),
  });

  const form = useForm<SmsTemplatesFormValues>({
    mode: 'uncontrolled',
    initialValues: {
      smsFactorEnabled: initial.smsFactorEnabled,
      smsTemplate: initial.smsTemplate,
      smsNoticeEnabled: initial.smsNoticeEnabled,
      smsNoticeTemplate: initial.smsNoticeTemplate,
      paymentLinkSmsEnabled: initial.paymentLinkSmsEnabled,
      paymentLinkSmsTemplate: initial.paymentLinkSmsTemplate,
      paymentLinkUsePattern: initial.paymentLinkUsePattern,
      medianaPaymentLinkPatternCode: initial.medianaPaymentLinkPatternCode,
      medianaPaymentLinkPatternParams: initial.medianaPaymentLinkPatternParams.map((param) => ({
        ...param,
      })),
      otpSmsEnabled: initial.otpSmsEnabled,
      otpSmsTemplate: initial.otpSmsTemplate,
      smsUsePattern: initial.smsUsePattern,
      medianaPatternCode: initial.medianaPatternCode,
      medianaPatternParams: initial.medianaPatternParams.map((param) => ({ ...param })),
      smsNoticeUsePattern: initial.smsNoticeUsePattern,
      medianaNoticePatternCode: initial.medianaNoticePatternCode,
      medianaNoticePatternParams: initial.medianaNoticePatternParams.map((param) => ({
        ...param,
      })),
      medianaOtpUsePattern: initial.medianaOtpUsePattern,
      medianaOtpPatternCode: initial.medianaOtpPatternCode,
      medianaOtpPatternParams: initial.medianaOtpPatternParams.map((param) => ({ ...param })),
      smsirPatternConfig: {
        factor: kind(initial.smsirPatternConfig.factor),
        notice: kind(initial.smsirPatternConfig.notice),
        otp: kind(initial.smsirPatternConfig.otp),
        payment_link: kind(initial.smsirPatternConfig.payment_link),
      },
      farazPatternConfig: {
        factor: kind(initial.farazPatternConfig.factor),
        notice: kind(initial.farazPatternConfig.notice),
        otp: kind(initial.farazPatternConfig.otp),
        payment_link: kind(initial.farazPatternConfig.payment_link),
      },
    },
    validate: {
      medianaPatternCode: (value, values) =>
        values.smsUsePattern && value.trim() === ''
          ? 'برای ارسال با الگو، کد پترن را از پنل مدیانا وارد کنید.'
          : null,
      medianaNoticePatternCode: (value, values) =>
        values.smsNoticeUsePattern && value.trim() === ''
          ? 'برای اطلاع‌رسانی با الگو، کد پترن را از پنل مدیانا وارد کنید.'
          : null,
      medianaOtpPatternCode: (value, values) =>
        values.medianaOtpUsePattern && value.trim() === ''
          ? 'برای ارسال کد ورود با الگو، کد پترن را از پنل مدیانا وارد کنید.'
          : null,
      medianaPaymentLinkPatternCode: (value, values) =>
        values.paymentLinkUsePattern && value.trim() === ''
          ? 'برای ارسال لینک پرداخت با الگو، کد پترن را از پنل مدیانا وارد کنید.'
          : null,
    },
  });

  // Uncontrolled form: the reactive preview/switch UI rides on watches.
  const [smsFactorEnabled, setSmsFactorEnabled] = useState(initial.smsFactorEnabled);
  const [smsTemplate, setSmsTemplate] = useState(initial.smsTemplate);
  const [smsNoticeEnabled, setSmsNoticeEnabled] = useState(initial.smsNoticeEnabled);
  const [smsNoticeTemplate, setSmsNoticeTemplate] = useState(initial.smsNoticeTemplate);
  const [paymentLinkSmsEnabled, setPaymentLinkSmsEnabled] = useState(initial.paymentLinkSmsEnabled);
  const [paymentLinkSmsTemplate, setPaymentLinkSmsTemplate] = useState(
    initial.paymentLinkSmsTemplate
  );
  const [paymentLinkUsePattern, setPaymentLinkUsePattern] = useState(initial.paymentLinkUsePattern);
  const [otpSmsEnabled, setOtpSmsEnabled] = useState(initial.otpSmsEnabled);
  const [otpSmsTemplate, setOtpSmsTemplate] = useState(initial.otpSmsTemplate);
  const [smsUsePattern, setSmsUsePattern] = useState(initial.smsUsePattern);
  const [smsNoticeUsePattern, setSmsNoticeUsePattern] = useState(initial.smsNoticeUsePattern);
  const [medianaOtpUsePattern, setMedianaOtpUsePattern] = useState(initial.medianaOtpUsePattern);
  const [smsirFactorEnabled, setSmsirFactorEnabled] = useState(
    initial.smsirPatternConfig.factor.enabled
  );
  const [smsirNoticeEnabled, setSmsirNoticeEnabled] = useState(
    initial.smsirPatternConfig.notice.enabled
  );
  const [smsirOtpEnabled, setSmsirOtpEnabled] = useState(initial.smsirPatternConfig.otp.enabled);
  const [smsirPaymentLinkEnabled, setSmsirPaymentLinkEnabled] = useState(
    initial.smsirPatternConfig.payment_link.enabled
  );
  const [farazFactorEnabled, setFarazFactorEnabled] = useState(
    initial.farazPatternConfig.factor.enabled
  );
  const [farazNoticeEnabled, setFarazNoticeEnabled] = useState(
    initial.farazPatternConfig.notice.enabled
  );
  const [farazOtpEnabled, setFarazOtpEnabled] = useState(initial.farazPatternConfig.otp.enabled);
  const [farazPaymentLinkEnabled, setFarazPaymentLinkEnabled] = useState(
    initial.farazPatternConfig.payment_link.enabled
  );
  form.watch('smsFactorEnabled', ({ value }) => setSmsFactorEnabled(value));
  form.watch('smsTemplate', ({ value }) => setSmsTemplate(value));
  form.watch('smsNoticeEnabled', ({ value }) => setSmsNoticeEnabled(value));
  form.watch('smsNoticeTemplate', ({ value }) => setSmsNoticeTemplate(value));
  form.watch('paymentLinkSmsEnabled', ({ value }) => setPaymentLinkSmsEnabled(value));
  form.watch('paymentLinkSmsTemplate', ({ value }) => setPaymentLinkSmsTemplate(value));
  form.watch('paymentLinkUsePattern', ({ value }) => setPaymentLinkUsePattern(value));
  form.watch('otpSmsEnabled', ({ value }) => setOtpSmsEnabled(value));
  form.watch('otpSmsTemplate', ({ value }) => setOtpSmsTemplate(value));
  form.watch('smsUsePattern', ({ value }) => setSmsUsePattern(value));
  form.watch('smsNoticeUsePattern', ({ value }) => setSmsNoticeUsePattern(value));
  form.watch('medianaOtpUsePattern', ({ value }) => setMedianaOtpUsePattern(value));
  form.watch('smsirPatternConfig.factor.enabled', ({ value }) => setSmsirFactorEnabled(value));
  form.watch('smsirPatternConfig.notice.enabled', ({ value }) => setSmsirNoticeEnabled(value));
  form.watch('smsirPatternConfig.otp.enabled', ({ value }) => setSmsirOtpEnabled(value));
  form.watch('smsirPatternConfig.payment_link.enabled', ({ value }) =>
    setSmsirPaymentLinkEnabled(value)
  );
  form.watch('farazPatternConfig.factor.enabled', ({ value }) => setFarazFactorEnabled(value));
  form.watch('farazPatternConfig.notice.enabled', ({ value }) => setFarazNoticeEnabled(value));
  form.watch('farazPatternConfig.otp.enabled', ({ value }) => setFarazOtpEnabled(value));
  form.watch('farazPatternConfig.payment_link.enabled', ({ value }) =>
    setFarazPaymentLinkEnabled(value)
  );

  async function handleSubmit(values: SmsTemplatesFormValues) {
    setSaving(true);
    try {
      const cleanParams = (params: SmsPatternParam[]) =>
        params
          .map((param) => ({ key: param.key.trim(), value: param.value }))
          .filter((param) => param.key !== '');

      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smsFactorEnabled: values.smsFactorEnabled,
          smsTemplate: values.smsTemplate,
          smsNoticeEnabled: values.smsNoticeEnabled,
          smsNoticeTemplate: values.smsNoticeTemplate,
          paymentLinkSmsEnabled: values.paymentLinkSmsEnabled,
          paymentLinkSmsTemplate: values.paymentLinkSmsTemplate,
          paymentLinkUsePattern: values.paymentLinkUsePattern,
          medianaPaymentLinkPatternCode: values.medianaPaymentLinkPatternCode.trim(),
          medianaPaymentLinkPatternParams: cleanParams(values.medianaPaymentLinkPatternParams),
          otpSmsEnabled: values.otpSmsEnabled,
          otpSmsTemplate: values.otpSmsTemplate,
          smsUsePattern: values.smsUsePattern,
          medianaPatternCode: values.medianaPatternCode.trim(),
          medianaPatternParams: cleanParams(values.medianaPatternParams),
          smsNoticeUsePattern: values.smsNoticeUsePattern,
          medianaNoticePatternCode: values.medianaNoticePatternCode.trim(),
          medianaNoticePatternParams: cleanParams(values.medianaNoticePatternParams),
          medianaOtpUsePattern: values.medianaOtpUsePattern,
          medianaOtpPatternCode: values.medianaOtpPatternCode.trim(),
          medianaOtpPatternParams: cleanParams(values.medianaOtpPatternParams),
          smsirPatternConfig: {
            factor: {
              enabled: values.smsirPatternConfig.factor.enabled,
              code: values.smsirPatternConfig.factor.code.trim(),
              params: cleanParams(values.smsirPatternConfig.factor.params),
            },
            notice: {
              enabled: values.smsirPatternConfig.notice.enabled,
              code: values.smsirPatternConfig.notice.code.trim(),
              params: cleanParams(values.smsirPatternConfig.notice.params),
            },
            otp: {
              enabled: values.smsirPatternConfig.otp.enabled,
              code: values.smsirPatternConfig.otp.code.trim(),
              params: cleanParams(values.smsirPatternConfig.otp.params),
            },
            payment_link: {
              enabled: values.smsirPatternConfig.payment_link.enabled,
              code: values.smsirPatternConfig.payment_link.code.trim(),
              params: cleanParams(values.smsirPatternConfig.payment_link.params),
            },
          },
          farazPatternConfig: {
            factor: {
              enabled: values.farazPatternConfig.factor.enabled,
              code: values.farazPatternConfig.factor.code.trim(),
              params: cleanParams(values.farazPatternConfig.factor.params),
            },
            notice: {
              enabled: values.farazPatternConfig.notice.enabled,
              code: values.farazPatternConfig.notice.code.trim(),
              params: cleanParams(values.farazPatternConfig.notice.params),
            },
            otp: {
              enabled: values.farazPatternConfig.otp.enabled,
              code: values.farazPatternConfig.otp.code.trim(),
              params: cleanParams(values.farazPatternConfig.otp.params),
            },
            payment_link: {
              enabled: values.farazPatternConfig.payment_link.enabled,
              code: values.farazPatternConfig.payment_link.code.trim(),
              params: cleanParams(values.farazPatternConfig.payment_link.params),
            },
          },
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
        message: 'الگوهای پیامکی به‌روزرسانی شد.',
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
        <Text size="sm" c="dimmed">
          هر الگو مثل نمونه: عنوان الگو و کلید «الگو فعال است؟» در بالای کارت، متن الگو در «الگوی
          پیام متنی» و جای‌نگهدارها در جدول «الگوها» کنارش — با دکمهٔ کپی در متن بگذارید. اگر برای
          پنل فعال‌تان «ارسال با الگو» روشن باشد، به‌جای متن آزاد، الگوی پنل ارسال می‌شود. هر کارت
          با کلیک روی عنوانش جمع می‌شود.
        </Text>

        {/* ---- پیامک فاکتور (پس از پرداخت) ---- */}
        <KindAccordion
          icon={<IconCreditCard size={18} />}
          title="پیامک فاکتور (پس از پرداخت)"
          templateTitle="پیامک فاکتور (پس از پرداخت)"
          enableSwitch={<TemplateEnableSwitch form={form} path="smsFactorEnabled" />}
        >
          <Grid gutter="md">
            <GridCol span={{ base: 12, sm: 7 }}>
              <Stack gap="sm">
                {!smsFactorEnabled ? (
                  <Text size="xs" c="red" fw={500}>
                    این الگو غیرفعال است؛ پس از پرداخت سفارش، پیامکی برای مشتری ارسال نمی‌شود.
                  </Text>
                ) : null}
                <Textarea
                  label="الگوی پیام متنی"
                  description="پس از پرداخت موفق هر سفارش برای موبایل مشتری ارسال می‌شود. در حالت الگو، متن پیامک توسط پنل ساخته می‌شود و این متن استفاده نمی‌شود."
                  autosize
                  minRows={8}
                  disabled={smsUsePattern || !smsFactorEnabled}
                  key={form.key('smsTemplate')}
                  {...form.getInputProps('smsTemplate')}
                />
                {!smsUsePattern && smsFactorEnabled ? (
                  <TemplatePreview template={smsTemplate} />
                ) : null}
              </Stack>
            </GridCol>
            <GridCol span={{ base: 12, sm: 5 }}>
              <PatternTokenTable
                tokens={['{order}', '{amount}', '{refId}', '{date}', '{delivery}']}
              />
            </GridCol>
          </Grid>

          <Divider labelPosition="center" label="ارسال با الگو (پترن)" />
          <Text size="xs" c="dimmed">
            روش راه‌اندازی الگو در همه پنل‌ها یکسان است: در پنل پیامکی‌تان یک الگو بسازید، متن آن را
            با جای‌نگهدارهای جدول «الگوها» بنویسید، سپس کد پترن را در تب همان پنل وارد کنید و هر
            پارامتر الگو را به مقدار فاکتور وصل کنید.
          </Text>
          <PatternTabs
            mediana={
              <PatternSetupSection
                form={form}
                enabledPath="smsUsePattern"
                codePath="medianaPatternCode"
                paramsPath="medianaPatternParams"
                enabled={smsUsePattern}
                codeLabel="کد پترن"
                codeDescription="کد پترنی تعریف‌شده در پنل مدیانا (بخش الگوها / Patterns)."
                keyPlaceholder="نام پارامتر در پنل مدیانا"
                switchDescription="پیامک پرداخت به‌جای متن آزاد، با الگوی تعریف‌شده در پنل مدیانا ارسال می‌شود."
              />
            }
            smsir={
              <PatternSetupSection
                form={form}
                enabledPath="smsirPatternConfig.factor.enabled"
                codePath="smsirPatternConfig.factor.code"
                paramsPath="smsirPatternConfig.factor.params"
                enabled={smsirFactorEnabled}
                codeLabel="کد قالب (Template ID)"
                codeDescription="شناسه قالب تعریف‌شده در پنل sms.ir."
                keyPlaceholder="نام پارامتر در قالب sms.ir"
                switchDescription="پیامک پرداخت با قالب (Verify Template) تعریف‌شده در پنل sms.ir ارسال می‌شود."
              />
            }
            faraz={
              <PatternSetupSection
                form={form}
                enabledPath="farazPatternConfig.factor.enabled"
                codePath="farazPatternConfig.factor.code"
                paramsPath="farazPatternConfig.factor.params"
                enabled={farazFactorEnabled}
                codeLabel="کد پترن (Pattern Code)"
                codeDescription="کد پترنی تعریف‌شده در پنل فراز اس‌ام‌اس."
                keyPlaceholder="نام پارامتر در الگوی فراز"
                switchDescription="پیامک پرداخت با الگوی تعریف‌شده در پنل فراز اس‌ام‌اس ارسال می‌شود."
              />
            }
          />
        </KindAccordion>

        {/* ---- اطلاع‌رسانی ارسال سفارش ---- */}
        <KindAccordion
          icon={<IconTruck size={18} />}
          title="اطلاع‌رسانی ارسال سفارش"
          templateTitle="اطلاع‌رسانی ارسال سفارش"
          enableSwitch={<TemplateEnableSwitch form={form} path="smsNoticeEnabled" />}
        >
          <Grid gutter="md">
            <GridCol span={{ base: 12, sm: 7 }}>
              <Stack gap="sm">
                {!smsNoticeEnabled ? (
                  <Text size="xs" c="red" fw={500}>
                    این الگو غیرفعال است؛ دکمه «اطلاع‌رسانی پیامک» سفارش، پیامکی ارسال نمی‌کند.
                  </Text>
                ) : null}
                <Textarea
                  label="الگوی پیام متنی"
                  description="وقتی مدیر سفارش را «ارسال شده» می‌کند و دکمه اطلاع‌رسانی را می‌زند، برای موبایل مشتری ارسال می‌شود."
                  autosize
                  minRows={8}
                  disabled={smsNoticeUsePattern || !smsNoticeEnabled}
                  key={form.key('smsNoticeTemplate')}
                  {...form.getInputProps('smsNoticeTemplate')}
                />
                {!smsNoticeUsePattern && smsNoticeEnabled ? (
                  <TemplatePreview template={smsNoticeTemplate} />
                ) : null}
              </Stack>
            </GridCol>
            <GridCol span={{ base: 12, sm: 5 }}>
              <PatternTokenTable tokens={['{order}', '{tracking}', '{delivery}', '{date}']} />
            </GridCol>
          </Grid>

          <Divider labelPosition="center" label="ارسال با الگو (پترن)" />
          <PatternTabs
            mediana={
              <PatternSetupSection
                form={form}
                enabledPath="smsNoticeUsePattern"
                codePath="medianaNoticePatternCode"
                paramsPath="medianaNoticePatternParams"
                enabled={smsNoticeUsePattern}
                codeLabel="کد پترن"
                codeDescription="کد پترنی اطلاع‌رسانی تعریف‌شده در پنل مدیانا."
                keyPlaceholder="نام پارامتر در پنل مدیانا"
                switchDescription="پیامک اطلاع‌رسانی ارسال (پس از پست شدن سفارش) با الگوی جداگانهٔ مدیانا ارسال می‌شود."
              />
            }
            smsir={
              <PatternSetupSection
                form={form}
                enabledPath="smsirPatternConfig.notice.enabled"
                codePath="smsirPatternConfig.notice.code"
                paramsPath="smsirPatternConfig.notice.params"
                enabled={smsirNoticeEnabled}
                codeLabel="کد قالب (Template ID)"
                codeDescription="شناسه قالب اطلاع‌رسانی تعریف‌شده در پنل sms.ir."
                keyPlaceholder="نام پارامتر در قالب sms.ir"
                switchDescription="پیامک اطلاع‌رسانی ارسال با قالب جداگانهٔ sms.ir ارسال می‌شود."
              />
            }
            faraz={
              <PatternSetupSection
                form={form}
                enabledPath="farazPatternConfig.notice.enabled"
                codePath="farazPatternConfig.notice.code"
                paramsPath="farazPatternConfig.notice.params"
                enabled={farazNoticeEnabled}
                codeLabel="کد پترن (Pattern Code)"
                codeDescription="کد پترنی اطلاع‌رسانی تعریف‌شده در پنل فراز اس‌ام‌اس."
                keyPlaceholder="نام پارامتر در الگوی فراز"
                switchDescription="پیامک اطلاع‌رسانی ارسال با الگوی جداگانهٔ فراز اس‌ام‌اس ارسال می‌شود."
              />
            }
          />
        </KindAccordion>

        {/* ---- پیامک کد ورود (دو مرحله‌ای / OTP) ---- */}
        <KindAccordion
          icon={<IconKey size={18} />}
          title="پیامک کد ورود (دو مرحله‌ای / کد یکبار مصرف)"
          templateTitle="پیامک کد ورود (دو مرحله‌ای / کد یکبار مصرف)"
          enableSwitch={
            <TemplateEnableSwitch
              form={form}
              path="otpSmsEnabled"
              warning="غیرفعال کردن آن، ورود دو مرحله‌ای و رمز یکبار مصرف را ناممکن می‌کند."
            />
          }
        >
          <Grid gutter="md">
            <GridCol span={{ base: 12, sm: 7 }}>
              <Stack gap="sm">
                {!otpSmsEnabled ? (
                  <Text size="xs" c="red" fw={500}>
                    این الگو غیرفعال است؛ کاربرانی که ورود دو مرحله‌ای یا رمز یکبار مصرف دارند
                    نمی‌توانند کد ورود دریافت کنند.
                  </Text>
                ) : null}
                <Textarea
                  label="الگوی پیام متنی"
                  description="وقتی کاربری با روش «دو مرحله‌ای» یا «رمز یکبار مصرف» وارد می‌شود، این پیامک برایش ارسال می‌شود."
                  autosize
                  minRows={8}
                  disabled={medianaOtpUsePattern || !otpSmsEnabled}
                  key={form.key('otpSmsTemplate')}
                  {...form.getInputProps('otpSmsTemplate')}
                />
                {!medianaOtpUsePattern && otpSmsEnabled ? (
                  <TemplatePreview template={otpSmsTemplate} />
                ) : null}
              </Stack>
            </GridCol>
            <GridCol span={{ base: 12, sm: 5 }}>
              <PatternTokenTable tokens={['{code}', '{date}']} />
            </GridCol>
          </Grid>

          <Divider labelPosition="center" label="ارسال با الگو (پترن)" />
          <PatternTabs
            mediana={
              <PatternSetupSection
                form={form}
                enabledPath="medianaOtpUsePattern"
                codePath="medianaOtpPatternCode"
                paramsPath="medianaOtpPatternParams"
                enabled={medianaOtpUsePattern}
                codeLabel="کد پترن"
                codeDescription="کد پترنی کد ورود تعریف‌شده در پنل مدیانا."
                keyPlaceholder="نام پارامتر در پنل مدیانا"
                switchDescription="پیامک کد ورود به‌جای متن آزاد، با الگوی تعریف‌شده در پنل مدیانا ارسال می‌شود."
              />
            }
            smsir={
              <PatternSetupSection
                form={form}
                enabledPath="smsirPatternConfig.otp.enabled"
                codePath="smsirPatternConfig.otp.code"
                paramsPath="smsirPatternConfig.otp.params"
                enabled={smsirOtpEnabled}
                codeLabel="کد قالب (Template ID)"
                codeDescription="شناسه قالب کد ورود تعریف‌شده در پنل sms.ir."
                keyPlaceholder="نام پارامتر در قالب sms.ir"
                switchDescription="پیامک کد ورود با قالب (Verify Template) تعریف‌شده در پنل sms.ir ارسال می‌شود."
              />
            }
            faraz={
              <PatternSetupSection
                form={form}
                enabledPath="farazPatternConfig.otp.enabled"
                codePath="farazPatternConfig.otp.code"
                paramsPath="farazPatternConfig.otp.params"
                enabled={farazOtpEnabled}
                codeLabel="کد پترن (Pattern Code)"
                codeDescription="کد پترنی کد ورود تعریف‌شده در پنل فراز اس‌ام‌اس."
                keyPlaceholder="نام پارامتر در الگوی فراز"
                switchDescription="پیامک کد ورود با الگوی تعریف‌شده در پنل فراز اس‌ام‌اس ارسال می‌شود."
              />
            }
          />
        </KindAccordion>

        {/* ---- لینک پرداخت ---- */}
        <KindAccordion
          icon={<IconLink size={18} />}
          title="پیامک لینک پرداخت (ارسال برای شخص دیگر)"
          templateTitle="پیامک لینک پرداخت (ارسال برای شخص دیگر)"
          enableSwitch={<TemplateEnableSwitch form={form} path="paymentLinkSmsEnabled" />}
        >
          <Grid gutter="md">
            <GridCol span={{ base: 12, sm: 7 }}>
              <Stack gap="sm">
                {!paymentLinkSmsEnabled ? (
                  <Text size="xs" c="red" fw={500}>
                    این الگو غیرفعال است؛ گزینه «ارسال لینک پرداخت» در مرحله پرداخت، پیامکی ارسال
                    نمی‌کند.
                  </Text>
                ) : null}
                <Textarea
                  label="الگوی پیام متنی"
                  description="وقتی مشتری در مرحله پرداخت شماره‌ای را برای «ارسال لینک پرداخت» وارد کند، این متن با جای‌نگهدار {link} برای آن شماره ارسال می‌شود. گیرنده بدون ورود، فاکتور را می‌بیند و پرداخت می‌کند."
                  autosize
                  minRows={8}
                  disabled={paymentLinkUsePattern || !paymentLinkSmsEnabled}
                  key={form.key('paymentLinkSmsTemplate')}
                  {...form.getInputProps('paymentLinkSmsTemplate')}
                />
                {!paymentLinkUsePattern && paymentLinkSmsEnabled ? (
                  <TemplatePreview template={paymentLinkSmsTemplate} />
                ) : null}
              </Stack>
            </GridCol>
            <GridCol span={{ base: 12, sm: 5 }}>
              <PatternTokenTable tokens={['{order}', '{amount}', '{link}', '{date}']} />
            </GridCol>
          </Grid>

          <Divider labelPosition="center" label="ارسال با الگو (پترن)" />
          <Text size="xs" c="dimmed">
            مثل بقیه الگوها: در پنل پیامکی‌تان یک الگوی جداگانه برای لینک پرداخت بسازید، کد پترن را
            در تب همان پنل وارد کنید و پارامتر {'{link}'} را به جای‌نگهدار لینک وصل کنید.
          </Text>
          <PatternTabs
            mediana={
              <PatternSetupSection
                form={form}
                enabledPath="paymentLinkUsePattern"
                codePath="medianaPaymentLinkPatternCode"
                paramsPath="medianaPaymentLinkPatternParams"
                enabled={paymentLinkUsePattern}
                codeLabel="کد پترن"
                codeDescription="کد پترنی لینک پرداخت تعریف‌شده در پنل مدیانا."
                keyPlaceholder="نام پارامتر در پنل مدیانا"
                switchDescription="پیامک لینک پرداخت به‌جای متن آزاد، با الگوی تعریف‌شده در پنل مدیانا ارسال می‌شود."
              />
            }
            smsir={
              <PatternSetupSection
                form={form}
                enabledPath="smsirPatternConfig.payment_link.enabled"
                codePath="smsirPatternConfig.payment_link.code"
                paramsPath="smsirPatternConfig.payment_link.params"
                enabled={smsirPaymentLinkEnabled}
                codeLabel="کد قالب (Template ID)"
                codeDescription="شناسه قالب لینک پرداخت تعریف‌شده در پنل sms.ir."
                keyPlaceholder="نام پارامتر در قالب sms.ir"
                switchDescription="پیامک لینک پرداخت با قالب (Verify Template) تعریف‌شده در پنل sms.ir ارسال می‌شود."
              />
            }
            faraz={
              <PatternSetupSection
                form={form}
                enabledPath="farazPatternConfig.payment_link.enabled"
                codePath="farazPatternConfig.payment_link.code"
                paramsPath="farazPatternConfig.payment_link.params"
                enabled={farazPaymentLinkEnabled}
                codeLabel="کد پترن (Pattern Code)"
                codeDescription="کد پترنی لینک پرداخت تعریف‌شده در پنل فراز اس‌ام‌اس."
                keyPlaceholder="نام پارامتر در الگوی فراز"
                switchDescription="پیامک لینک پرداخت با الگوی تعریف‌شده در پنل فراز اس‌ام‌اس ارسال می‌شود."
              />
            }
          />
        </KindAccordion>

        <Group justify="flex-end">
          <Button type="submit" loading={saving} leftSection={<IconMessage2 size={16} />}>
            ذخیره الگوها
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
