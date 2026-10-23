import { Group } from '@mantine/core';
import ExportButton from '@/components/layout/ExportButton';
import PrintButton from '@/components/layout/PrintButton';

/**
 * جفت دکمه «دریافت خروجی» و «چاپ» — قاعده ثابت سربرگ هر صفحه لیست/گزارش:
 * خروجی اکسل از همان فیلترهای فعال صفحه (exportHref) و چاپ با قواعد
 * .no-print سراسری. هر دو در چاپ خودشان پنهان‌اند.
 */
export default function ListActions({
  exportHref,
  print = true,
}: {
  /** Endpoint اکسل همین لیست با فیلترهای فعلی — نبود یعنی این لیست خروجی ندارد. */
  exportHref?: string;
  print?: boolean;
}) {
  if (!exportHref && !print) {
    return null;
  }

  return (
    <Group gap="sm" wrap="nowrap" className="no-print">
      {exportHref ? <ExportButton href={exportHref} /> : null}
      {print ? <PrintButton /> : null}
    </Group>
  );
}
