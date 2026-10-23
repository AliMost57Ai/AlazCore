'use client';

import { IconDownload } from '@tabler/icons-react';
import { Button } from '@mantine/core';

export interface ExportButtonProps {
  /** Export endpoint with the current filters baked in. */
  href: string;
  label?: string;
}

/**
 * Downloads a list as a real .xlsx file generated server-side (exceljs) —
 * the generic sibling of ExportOrdersButton/ExportProductsButton for the
 * stock-list pages.
 */
export default function ExportButton({ href, label = 'دریافت خروجی' }: ExportButtonProps) {
  return (
    <Button leftSection={<IconDownload size={16} />} variant="default" component="a" href={href}>
      {label}
    </Button>
  );
}
