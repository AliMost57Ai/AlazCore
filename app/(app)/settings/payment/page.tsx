import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import PaymentSettings, { type SettingsGateway } from '@/components/settings/PaymentSettings';
import { requireSession } from '@/lib/auth';
import { GATEWAYS } from '@/lib/gateways/registry';
import { getOwnerAllowedCatalog } from '@/lib/owner-catalog';
import { getAppSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'تنظیمات — درگاه پرداخت',
};

/**
 * Admin-only: the online payment gateway (IPG) configuration — the nine
 * online gateways plus the shop-wide active/default gateway selection (the
 * BNPL credentials live on their own page, درگاه اقساطی).
 */
export default async function PaymentSettingsPage() {
  const session = await requireSession('/settings/payment');

  if (session.role !== 'admin') {
    redirect('/settings');
  }

  const [settings, rawCatalog] = await Promise.all([getAppSettings(), getOwnerAllowedCatalog()]);
  // null = Core تنظیم نشده — لیست‌ها بدون محدودیت رندر می‌شوند.
  const catalog = rawCatalog ?? { themes: null, ipg: null, bnpl: null, sms: null };
  // فقط درگاه‌هایی که پنل Core برای این دامنه فعال کرده (بند ۲-۸).
  const allowedGateways = catalog.ipg
    ? GATEWAYS.filter((gateway) => catalog.ipg!.includes(gateway.id))
    : GATEWAYS;
  const gateways: SettingsGateway[] = allowedGateways.map((gateway) => ({
    id: gateway.id,
    label: gateway.label,
    kind: gateway.kind,
    ready: gateway.isReady(settings),
  }));

  return (
    <Stack gap="lg">
      <PageHeader
        title="درگاه پرداخت"
        description="تنظیمات درگاه‌های پرداخت آنلاین و انتخاب درگاه‌های فعال و پیش‌فرض فروشگاه. درگاه‌های اقساطی (BNPL) در صفحه «درگاه اقساطی» پیکربندی می‌شوند."
      />
      <PaymentSettings initial={settings} gateways={gateways} allowedIpg={catalog.ipg} />
    </Stack>
  );
}
