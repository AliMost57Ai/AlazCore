'use client';

import { useRouter } from 'next/navigation';
import PickupRescheduleForm from '@/components/orders/PickupRescheduleForm';
import type { PickupOrderDTO } from '@/lib/pickup';

/**
 * کلاینت صفحه تغییر برنامه — پس از ثبت موفق به لیست تحویل حضوری برمی‌گردد
 * (صفحه اختصاصی جایگزین مودال در موبایل است).
 */
export default function ReschedulePageForm({ order }: { order: PickupOrderDTO }) {
  const router = useRouter();

  return (
    <PickupRescheduleForm
      order={order}
      onDone={() => {
        router.push('/orders/pickup');
        router.refresh();
      }}
    />
  );
}
