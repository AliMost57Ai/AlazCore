'use client';

import { IconDownload } from '@tabler/icons-react';
import { Button } from '@mantine/core';

export interface ExportOrdersButtonProps {
  /** Export endpoint with the current filters baked in. */
  href: string;
}

/**
 * Downloads the order list as a real .xlsx file. The workbook is generated
 * server-side (exceljs) from the same filtered query the table shows.
 */
export default function ExportOrdersButton({ href }: ExportOrdersButtonProps) {
  return (
    <Button
      leftSection={<IconDownload size={16} />}
      variant="default"
      size="sm"
      component="a"
      href={href}
    >
      دریافت خروجی
    </Button>
  );
}
