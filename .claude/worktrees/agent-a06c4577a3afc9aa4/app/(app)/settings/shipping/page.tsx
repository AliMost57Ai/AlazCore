import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ShippingMethodsManager from '@/components/settings/ShippingMethodsManager';
import { requireSession } from '@/lib/auth';
import { listShippingMethods } from '@/lib/shipping';

export const metadata: Metadata = {
  title: 'تنظیمات — روشهای ارسال',
};

/**
 * Admin-only: the shipping-method manager (روش‌های ارسال) — the delivery
 * options the customer picks at checkout, with their descriptions, minimum
 * delivery times, minimum costs, and invoice/COD (پس‌کرایه) rule.
 */
export default async function ShippingMethodsPage() {
  const session = await requireSession('/settings/shipping');

  if (session.role !== 'admin') {
    redirect('/settings');
  }

  const methods = await listShippingMethods();

  return (
    <Stack gap="lg">
      <PageHeader
        title="روشهای ارسال"
        description="روش‌های ارسال قابل انتخاب در تسویه‌حساب — توضیح، حداقل زمان ارسال، حداقل هزینه ارسال و محاسبه هزینه در فاکتور یا پس‌کرایه."
      />
      <ShippingMethodsManager initial={methods} />
    </Stack>
  );
}
