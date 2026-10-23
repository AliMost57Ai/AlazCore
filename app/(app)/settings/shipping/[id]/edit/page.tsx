import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Card, Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ShippingMethodForm from '@/components/settings/ShippingMethodForm';
import { requireSession } from '@/lib/auth';
import { listShippingMethods } from '@/lib/shipping';

export const metadata: Metadata = {
  title: 'ویرایش روش ارسال',
};

type PageProps = { params: Promise<{ id: string }> };

/** صفحه اختصاصی ویرایش روش ارسال — به‌جای مودال (فرم بیش از ۴ فیلد). */
export default async function EditShippingMethodPage({ params }: PageProps) {
  const session = await requireSession('/settings/shipping');

  if (session.role !== 'admin') {
    redirect('/settings');
  }

  const { id } = await params;
  const methods = await listShippingMethods();
  const method = methods.find((row) => row.id === id);

  if (!method) {
    notFound();
  }

  return (
    <Stack gap="lg">
      <PageHeader title={`ویرایش «${method.name}»`} description="تغییرات خود را ذخیره کنید." />
      <Card>
        <ShippingMethodForm initial={method} />
      </Card>
    </Stack>
  );
}
