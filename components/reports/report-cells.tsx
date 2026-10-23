import type { ReactNode } from 'react';
import { Text } from '@mantine/core';
import { enNumber } from '@/lib/format';

/**
 * سلول‌های مشترک جدول‌های گزارش مالی — ارقام جدولی (tabular-nums)، صفر کم‌جان
 * «—»، منفی قرمز. مبالغ بدون واحد چاپ می‌شوند (زیرنویس «واحد مبالغ: تومان»
 * روی هر صفحه گزارش) تا جدول در A4 بدون برش جا شود.
 */

const NUMERIC = { fontVariantNumeric: 'tabular-nums' } as const;

export function MoneyCell({
  value,
  bold = false,
  danger = false,
}: {
  value: number;
  bold?: boolean;
  /** مثبت‌های «بدهی/کسر» — نارنجی نمایش داده می‌شوند (زبان جدول حسابداری). */
  danger?: boolean;
}): ReactNode {
  if (value === 0) {
    return (
      <Text size="sm" c="dimmed" style={NUMERIC}>
        —
      </Text>
    );
  }
  const negative = value < 0;
  return (
    <Text
      size="sm"
      fw={bold ? 700 : 600}
      c={negative || danger ? (negative ? 'red.7' : 'orange.7') : undefined}
      style={NUMERIC}
    >
      {negative ? `−${enNumber(Math.abs(value))}` : enNumber(value)}
    </Text>
  );
}

/** سلول عددی غیر پولی (تعداد سفارش، تعداد استفاده…). */
export function CountCell({ value }: { value: number }): ReactNode {
  return (
    <Text size="sm" fw={500} style={NUMERIC}>
      {enNumber(value)}
    </Text>
  );
}
