'use client';

import { IconDownload } from '@tabler/icons-react';
import { Button } from '@mantine/core';

export interface ExportProductsButtonProps {
  /** Export endpoint with the current filters baked in. */
  href: string;
}

/**
 * Downloads the product list as a real .xlsx file. The same sheet is the
 * price-import template: rows with an empty «نوع» column update the product,
 * rows naming a variant update that variant.
 */
export default function ExportProductsButton({ href }: ExportProductsButtonProps) {
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
