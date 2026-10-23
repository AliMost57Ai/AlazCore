'use client';

import { IconHistory } from '@tabler/icons-react';
import { Divider, Stack, Text } from '@mantine/core';
import EmptyState from '@/components/layout/EmptyState';
import PriceChangesTable from '@/components/ui/panel/PriceChangesTable';
import { faJalaliLongDate } from '@/lib/format';
import { describeAdjust, type PriceAdjustType } from '@/lib/price-adjust';
import type { PriceChangeBatchDTO } from '@/lib/price-updates';

/**
 * The audit trail of batch price updates (Finance → به‌روزرسانی قیمت), newest
 * first: one block per batch — who changed what, when, and every price that
 * moved. Sold invoices are never rewritten, so this history is the only place
 * price changes are recorded. جدول تغییرها با کامپوننت مشترک
 * PriceChangesTable رندر می‌شود (هم‌شکل پیش‌نمایش پنل).
 */
export default function PriceHistoryTable({ batches }: { batches: PriceChangeBatchDTO[] }) {
  if (batches.length === 0) {
    return (
      <EmptyState
        icon={IconHistory}
        message="هنوز تغییری در قیمت‌ها ثبت نشده است."
        hint="اولین تغییر گروهی قیمت پس از ثبت در همین تاریخچه می‌آید."
      />
    );
  }

  return (
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
          <PriceChangesTable changes={batch.changes} withDelta />
        </Stack>
      ))}
    </Stack>
  );
}
