'use client';

import type { ReactNode } from 'react';
import { Modal } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

export interface ResponsiveModalProps {
  opened: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** عرض مودال دسکتاپ — در موبایل مودال تمام‌صفحه است. */
  size?: string | number;
}

/**
 * مودال ریسپانسیو پنل — قاعده واحد: در دسکتاپ مودال شناورِ وسط، در موبایل
 * (تا ۴۸em) تمام‌صفحه تا فرم‌ها فضای واقعی داشته باشند و قاب کوچکِ موبایل
 * محتوای بلند را له نکند. جایگزین مستقیم Modal در فرم‌های ایجاد/ویرایش.
 */
export default function ResponsiveModal({
  opened,
  onClose,
  title,
  children,
  size = 'md',
}: ResponsiveModalProps) {
  const isMobile = useMediaQuery('(max-width: 48em)', false, { getInitialValueInEffect: false });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size={size}
      centered={!isMobile}
      fullScreen={isMobile}
    >
      {children}
    </Modal>
  );
}
