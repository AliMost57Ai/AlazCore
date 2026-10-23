'use client';

import { IconPlus } from '@tabler/icons-react';
import { Button } from '@mantine/core';

export interface NewProductButtonProps {
  /** Roles without the products:add grant don't see the button (the API
   *  enforces it anyway). */
  canAdd: boolean;
}

export default function NewProductButton({ canAdd }: NewProductButtonProps) {
  if (!canAdd) {
    return null;
  }

  return (
    <Button component="a" href="/products/new" leftSection={<IconPlus size={16} />} size="sm">
      افزودن محصول
    </Button>
  );
}
