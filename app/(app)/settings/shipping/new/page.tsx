import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ShippingMethodForm from '@/components/settings/ShippingMethodForm';
import { requireSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'روش ارسال جدید',
};

/** صفحه اختصاصی ساخت روش ارسال — فرم‌های بیش از ۴ فیلد مودال باز نمی‌شوند. */
export default async function NewShippingMethodPage() {
  const session = await requireSession('/settings/shipping');

  if (session.role !== 'admin') {
    redirect('/settings');
  }

  return (
    <Stack gap="lg">
      <PageHeader title="روش ارسال جدید" description="روشی که مشتری در تسویه‌حساب انتخاب می‌کند." />
      <Card>
        <ShippingMethodForm />
      </Card>
    </Stack>
  );
}
