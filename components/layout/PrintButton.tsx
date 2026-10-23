'use client';

import { IconPrinter } from '@tabler/icons-react';
import { Button } from '@mantine/core';

/**
 * دکمه چاپ صفحه — همان الگوی نوار عملیات ReportDocument (window.print)؛
 * قواعد @media print هر صفحه، کروم پنل و کنترل‌ها را پنهان می‌کند.
 */
export default function PrintButton({ label = 'چاپ' }: { label?: string }) {
  return (
    <Button variant="light" leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>
      {label}
    </Button>
  );
}
