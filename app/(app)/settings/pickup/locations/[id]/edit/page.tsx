import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Card, Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import PickupLocationForm from '@/components/settings/PickupLocationForm';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { isInPersonDeliveryEnabled } from '@/lib/core-license';
import { listPickupLocations } from '@/lib/pickup';

export const metadata: Metadata = {
  title: 'ویرایش نقطه تحویل',
};

type PageProps = { params: Promise<{ id: string }> };

/** صفحه اختصاصی ویرایش نقطه تحویل حضوری — به‌جای مودال (فرم بیش از ۴ فیلد). */
export default async function EditPickupLocationPage({ params }: PageProps) {
  const session = await requireSession('/settings/pickup');
  if (!canAccessMenu(session, '/settings/pickup')) {
    redirect('/dashboard');
  }
  if (!(await isInPersonDeliveryEnabled())) {
    redirect('/dashboard');
  }

  const { id } = await params;
  const locations = await listPickupLocations();
  const location = locations.find((row) => row.id === id);

  if (!location) {
    notFound();
  }

  return (
    <Stack gap="lg">
      <PageHeader title={`ویرایش «${location.title}»`} description="تغییرات خود را ذخیره کنید." />
      <Card>
        <PickupLocationForm initial={location} />
      </Card>
    </Stack>
  );
}
