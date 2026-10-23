import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import BnplSettings from '@/components/settings/BnplSettings';
import type { SettingsGateway } from '@/components/settings/PaymentSettings';
import { requireSession } from '@/lib/auth';
import { GATEWAYS } from '@/lib/gateways/registry';
import { getOwnerAllowedCatalog } from '@/lib/owner-catalog';
import { getAppSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'تنظیمات — درگاه اقساطی',
};

/**
 * Admin-only: the BNPL (خرید اعتباری / اقساطی) gateway configuration —
 * DigiPay, SnappPay, Tara, Vibe, Keepa, MiniPay and Fakher. The shop-wide
 * active/default gateway selection lives on the درگاه پرداخت page.
 */
export default async function BnplSettingsPage() {
  const session = await requireSession('/settings/bnpl');

  if (session.role !== 'admin') {
    redirect('/settings');
  }

  const settings = await getAppSettings();
  const rawCatalog = await getOwnerAllowedCatalog();
  // null = Core تنظیم نشده — لیست‌ها بدون محدودیت رندر می‌شوند.
  const catalog = rawCatalog ?? { themes: null, ipg: null, bnpl: null, sms: null };
  const bnplAllowed = catalog.bnpl
    ? GATEWAYS.filter((gateway) => catalog.bnpl!.includes(gateway.id))
    : GATEWAYS;
  const gateways: SettingsGateway[] = bnplAllowed.map((gateway) => ({
    id: gateway.id,
    label: gateway.label,
    kind: gateway.kind,
    ready: gateway.isReady(settings),
  }));

  return (
    <Stack gap="lg">
      <PageHeader
        title="درگاه اقساطی"
        description="تنظیمات درگاه‌های خرید اعتباری (BNPL): دیجی‌پی، اسنپ‌پی، تارا، وایب، کیپا، مینی‌پی و فاخر. فعال‌سازی و انتخاب پیش‌فرض روی ردیف هر درگاه انجام می‌شود (درگاه‌های پرداخت آنلاین در صفحه «درگاه پرداخت»)."
      />
      <BnplSettings initial={settings} gateways={gateways} allowedBnpl={catalog.bnpl} />
    </Stack>
  );
}
