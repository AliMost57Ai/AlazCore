'use client';

import { IconFileSpreadsheet, IconPrinter } from '@tabler/icons-react';
import { Button, Group, Stack, Text, Title } from '@mantine/core';
import classes from './ReportDocument.module.css';

/**
 * سند رسمی گزارش سمت فروشگاه — گرید خط‌کشی‌شده با سربرگ سند و نوار عملیات
 * (چاپ + خروجی اکسل). جدول عمداً <table> خام است: compoundهای Mantine Table
 * در صفحات سروریِ فروشگاه undefined برمی‌گردند (optimizePackageImports) و
 * ردیف‌ها به‌صورت children از صفحه سروری می‌آیند.
 */

export interface ReportDocumentProps {
  title: string;
  exportHref: string;
  exportQuery?: string;
  filtersSummary: string[];
  headers: string[];
  children: React.ReactNode;
  footerTotal?: { label: string; value: string }[];
}

export default function ReportDocument({
  title,
  exportHref,
  exportQuery,
  filtersSummary,
  headers,
  children,
  footerTotal,
}: ReportDocumentProps) {
  return (
    <Stack gap="lg" className={classes.document}>
      <Group justify="space-between" wrap="nowrap" gap="sm" className="no-print">
        <Title order={2}>{title}</Title>
        <Group gap="xs" wrap="nowrap">
          <Button
            variant="light"
            leftSection={<IconPrinter size={16} />}
            onClick={() => window.print()}
          >
            چاپ
          </Button>
          <Button
            component="a"
            href={`${exportHref}${exportQuery ? `?${exportQuery}` : ''}`}
            target="_blank"
            leftSection={<IconFileSpreadsheet size={16} />}
            variant="light"
            color="teal"
          >
            خروجی اکسل
          </Button>
        </Group>
      </Group>

      <div className={classes.docHeader}>
        <Group justify="space-between" align="flex-end" wrap="nowrap">
          <div>
            <Text fw={800} size="lg" className={classes.docTitle}>
              {title}
            </Text>
            <Text size="xs" c="dimmed">
              سامانه فروشگاه‌ساز AlazCore
            </Text>
          </div>
          <Text size="xs" c="dimmed">
            تاریخ سند:{' '}
            {new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'full' }).format(
              new Date()
            )}
          </Text>
        </Group>
        {filtersSummary.length > 0 ? (
          <Group gap="lg" mt={6}>
            {filtersSummary.map((item) => (
              <Text key={item} size="xs" c="dimmed">
                {item}
              </Text>
            ))}
          </Group>
        ) : null}
      </div>

      <div className={classes.grid}>
        <table className={classes.table}>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
          {footerTotal ? (
            <tfoot>
              <tr>
                {footerTotal.map((cell, index) => (
                  <td key={cell.label} className={classes.totalCell}>
                    {index === 0 ? cell.label : cell.value}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <Text size="xs" c="dimmed" className={classes.docFooter}>
        این سند توسط فروشگاه‌ساز AlazCore تولید شده است.
      </Text>
    </Stack>
  );
}
