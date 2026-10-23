import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ShippingMethodsManager from '@/components/settings/ShippingMethodsManager';
import { requireSession } from '@/lib/auth';
import { isInPersonDeliveryEnabled } from '@/lib/core-license';
import { listPickupLocations } from '@/lib/pickup';
import { listShippingMethods } from '@/lib/shipping';

export const metadata: Metadata = {
  title: 'تنظیمات — روشهای ارسال',
};

/**
 * Admin-only: the shipping-method manager (روش‌های ارسال) — the delivery
 * options the customer picks at checkout. وقتی تحویل حضوری در Core فعال
 * باشد، سکشن «تحویل حضوری» هم الگوهای تعریف‌شده را برای فعال‌سازی به‌عنوان
 * روش ارسال نشان می‌دهد.
 */
export default async function ShippingMethodsPage() {
  const session = await requireSession('/settings/shipping');

  if (session.role !== 'admin') {
    redirect('/settings');
  }

  const pickupEnabled = await isInPersonDeliveryEnabled();
  const [methods, pickupLocations] = await Promise.all([
    listShippingMethods(),
    pickupEnabled ? listPickupLocations() : Promise.resolve([]),
  ]);
  const pickupMethods = pickupEnabled ? methods.filter((method) => method.kind === 'pickup') : [];

  return (
    <Stack gap="lg">
      <PageHeader
        title="روشهای ارسال"
        description="روش‌های ارسال قابل انتخاب در تسویه‌حساب — توضیح، حداقل زمان ارسال، حداقل هزینه ارسال و محاسبه هزینه در فاکتور یا پس‌کرایه."
      />
      <ShippingMethodsManager
        initial={methods}
        pickupLocations={pickupLocations}
        pickupMethods={pickupMethods}
      />
    </Stack>
  );
}
