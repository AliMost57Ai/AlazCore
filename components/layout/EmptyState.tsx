import type { ComponentType, CSSProperties } from 'react';
import { Stack, Text } from '@mantine/core';

export interface EmptyStateProps {
  icon: ComponentType<{ size?: number; stroke?: number; style?: CSSProperties }>;
  /** جمله اصلی — وضعیت را می‌گوید، نه فقط «یافت نشد». */
  message: string;
  /** جمله دوم اختیاری — راهنمای گام بعدی کاربر. */
  hint?: string;
}

/**
 * حالت خالی استاندارد پنل — آیکون کم‌جان + پیام + راهنما؛ همان الگوی
 * UsersTable/CouponsTable که مشترک شد تا هر صفحه نوِ خودش را نزند.
 */
export default function EmptyState({ icon: Icon, message, hint }: EmptyStateProps) {
  return (
    <Stack gap={6} align="center" py="xl">
      <Icon size={36} stroke={1.2} style={{ color: 'var(--mantine-color-dimmed)' }} />
      <Text size="sm">{message}</Text>
      {hint ? (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      ) : null}
    </Stack>
  );
}
