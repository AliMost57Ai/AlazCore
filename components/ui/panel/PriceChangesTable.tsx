'use client';

import { Group, Stack, Table, Text } from '@mantine/core';
import { enCurrency, enNumber } from '@/lib/format';

export interface PanelPriceChange {
  productName: string;
  variantName?: string | null;
  oldPrice: number;
  newPrice: number;
  /** شناسه‌ها فقط برای key ردیف — اختیاری. */
  productId?: string;
  variantId?: string | null;
}

/**
 * جدول واحد تغییر قیمت — هم تاریخچهٔ به‌روزرسانی قیمت و هم پیش‌نمایش پنل
 * تغییر گروهی از همین کامپوننت مصرف می‌کنند تا شکل «قبلی → جدید» همه‌جا
 * یکسان بماند. دسکتاپ جدول، موبایل ردیف‌های تک‌ستونه (بدون اسکرول افقی).
 */
export default function PriceChangesTable({
  changes,
  withDelta = false,
}: {
  changes: PanelPriceChange[];
  /** ستون درصد تغییر — برای تاریخچه (پیش‌نمایش نیازی‌اش ندارد). */
  withDelta?: boolean;
}) {
  if (changes.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        هیچ قیمتی با این تغییر جابه‌جا نمی‌شود.
      </Text>
    );
  }

  return (
    <>
      <Stack gap={0} visibleFrom="sm">
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>کالا</Table.Th>
              <Table.Th>نوع</Table.Th>
              <Table.Th w={140} style={{ textAlign: 'end' }}>
                قیمت قبلی
              </Table.Th>
              <Table.Th w={140} style={{ textAlign: 'end' }}>
                قیمت جدید
              </Table.Th>
              {withDelta ? (
                <Table.Th w={100} style={{ textAlign: 'center' }}>
                  تغییر
                </Table.Th>
              ) : null}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {changes.map((change) => (
              <Table.Tr
                key={`${change.productId ?? change.productName}-${change.variantId ?? change.variantName ?? ''}`}
              >
                <Table.Td>{change.productName}</Table.Td>
                <Table.Td>{change.variantName ?? 'قیمت کالا'}</Table.Td>
                <Table.Td style={{ textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>
                  {enCurrency(change.oldPrice, false)}
                </Table.Td>
                <Table.Td style={{ textAlign: 'end', fontVariantNumeric: 'tabular-nums' }} fw={700}>
                  {enCurrency(change.newPrice, false)}
                </Table.Td>
                {withDelta ? (
                  <Table.Td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {change.oldPrice > 0
                      ? `${enNumber(((change.newPrice - change.oldPrice) / change.oldPrice) * 100, 1)}٪`
                      : '—'}
                  </Table.Td>
                ) : null}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>

      {/* موبایل: هر تغییر یک ردیف — قبلی خط‌خورده، جدید بولد. */}
      <Stack gap="sm" hiddenFrom="sm">
        {changes.map((change, index) => (
          <Stack
            key={`${change.productId ?? change.productName}-${change.variantId ?? change.variantName ?? ''}-${index}`}
            gap={2}
          >
            <Group justify="space-between" wrap="nowrap" gap="xs">
              <Text size="sm" fw={500} style={{ flex: 1 }}>
                {change.productName}
                {change.variantName ? (
                  <Text component="span" size="xs" c="dimmed">
                    {' '}
                    — {change.variantName}
                  </Text>
                ) : null}
              </Text>
              <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <Text component="span" c="dimmed" td="line-through" size="xs">
                  {enCurrency(change.oldPrice, false)}
                </Text>{' '}
                <Text component="span" fw={700}>
                  {enCurrency(change.newPrice, false)}
                </Text>
              </Text>
            </Group>
          </Stack>
        ))}
      </Stack>
    </>
  );
}
