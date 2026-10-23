'use client';

import { useRouter } from 'next/navigation';
import { IconArrowRight } from '@tabler/icons-react';
import { Button } from '@mantine/core';

/**
 * دکمه بازگشت صفحه جزئیات — به لیست قبلی برمی‌گردد (history.back) نه مقصد
 * ثابت؛ صفحه جزئیات از هر لیستی (سفارش‌ها، تحویل حضوری، حسابداری) باز می‌شود.
 */
export default function PanelBackButton({ label = 'بازگشت' }: { label?: string }) {
  const router = useRouter();

  return (
    <Button
      variant="subtle"
      color="gray"
      size="compact-sm"
      leftSection={<IconArrowRight size={16} />}
      onClick={() => router.back()}
    >
      {label}
    </Button>
  );
}
