'use client';

import { Card, Divider, Stack, Table, Text } from '@mantine/core';
import { faCurrency, faJalaliLongDate, faNumber } from '@/lib/format';
import { describeAdjust, type PriceAdjustType } from '@/lib/price-adjust';
import type { PriceChangeBatchDTO } from '@/lib/price-updates';

/**
 * The audit trail of batch price updates (Finance → به‌روزرسانی قیمت), newest
 * first: one block per batch — who changed what, when, and every price that
 * moved. Sold invoices are never rewritten, so this table is the only place
 * price changes are recorded.
 */
export default function PriceHistoryTable({ batches }: { batches: PriceChangeBatchDTO[] }) {
  if (batches.length === 0) {
    return (
      <Card>
        <Text size="sm" c="dimmed">
          هنوز تغییری در قیمت‌ها ثبت نشده است.
        </Text>
      </Card>
    );
  }

  return (
    <Card>
      <Stack gap="md">
        {batches.map((batch) => (
          <Stack key={batch.batchId} gap="xs">
            <Divider
              labelPosition="center"
              label={
                <Text size="xs" c="dimmed">
                  {faJalaliLongDate(new Date(batch.createdAt))} — {batch.actorName} — «
                  {batch.targetName}» (
                  {describeAdjust(batch.adjustType as PriceAdjustType, batch.adjustValue)})
                </Text>
              }
            />
            <Table.ScrollContainer minWidth={520}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>کالا</Table.Th>
                    <Table.Th>نوع</Table.Th>
                    <Table.Th>قیمت قبلی</Table.Th>
                    <Table.Th>قیمت جدید</Table.Th>
                    <Table.Th>تعداد تغییر</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {batch.changes.map((change) => (
                    <Table.Tr key={change.variantId ?? change.productId}>
                      <Table.Td>{change.productName}</Table.Td>
                      <Table.Td>{change.variantName ?? 'قیمت کالا'}</Table.Td>
                      <Table.Td>{faCurrency(change.oldPrice, false)}</Table.Td>
                      <Table.Td fw={700}>{faCurrency(change.newPrice, false)}</Table.Td>
                      <Table.Td>
                        {change.oldPrice > 0
                          ? `${faNumber(((change.newPrice - change.oldPrice) / change.oldPrice) * 100, 1)}٪`
                          : '—'}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
