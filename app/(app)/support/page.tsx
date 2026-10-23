import type { Metadata } from 'next';
import { Card } from '@mantine/core';
import { requireSession } from '@/lib/auth';
import { coreConfigured } from '@/lib/core-license';
import SupportClient from './SupportClient';

export const metadata: Metadata = { title: 'پشتیبانی AlazCore' };

/** تیکتینگ مالک↔پرسنل آلازکور — روی سیستم تیکت پنل Core، از پنل فروشگاه. */
export default async function SupportPage() {
  await requireSession('/support');

  return coreConfigured() ? (
    <SupportClient />
  ) : (
    <Card>
      اتصال به سامانه Core پیکربندی نشده است — متغیرهای CORE_API_URL و CORE_API_KEY را در تنظیمات
      سرور قرار دهید.
    </Card>
  );
}
