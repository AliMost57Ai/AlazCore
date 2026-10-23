'use client';

import Link from 'next/link';
import { Button, Group, Stack, Table, Text, Title } from '@mantine/core';
import { IconFileSpreadsheet, IconPrinter } from '@tabler/icons-react';
import classes from './ReportDocument.module.css';

/**
 * سند رسمی گزارش — گرید خط‌کشی‌شده با سربرگ سند (عنوان، بازه، تاریخ تولید)
 * و نوار عملیات: چاپ (window.print با CSS چاپ) و خروجی اکسل از API گزارش.
 * فیلترها به‌صورت «خلاصه اعمال‌شده» در سربرگ می‌آیند تا سند مستقل باشد.
 */

export interface ReportDocumentProps {
  title: string;
  /** query string فعلی برای اکسل — مثل domain=…&from=… */
  exportQuery?: string;
  exportHref: string;
  filtersSummary: string[];
  headers: string[];
  children: React.ReactNode;
  /** جمع کل در پانویس سند. */
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
  function print() {
    window.print();
  }

  return (
    <Stack gap="lg" className={classes.document}>
      <Group
        justify="space-between"
        wrap="nowrap"
        className="no-print"
        gap="sm"
      >
        <Title order={2}>{title}</Title>
        <Group gap="xs" wrap="nowrap">
          <Button
            variant="light"
            leftSection={<IconPrinter size={16} />}
            onClick={print}
          >
            چاپ
          </Button>
          <Button
            component={Link}
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

      {/* سربرگ سند — فقط در چاپ پررنگ می‌شود */}
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
            تاریخ سند: {new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'full' }).format(new Date())}
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
        <Table
          verticalSpacing="xs"
          withTableBorder
          withColumnBorders
          highlightOnHover
          horizontalSpacing="sm"
          className={classes.table}
        >
          <Table.Thead>
            <Table.Tr>
              {headers.map((header) => (
                <Table.Th key={header}>{header}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{children}</Table.Tbody>
          {footerTotal ? (
            <Table.Tfoot>
              <Table.Tr>
                {footerTotal.map((cell, index) => (
                  <Table.Td key={cell.label} fw={700} ta={index === 0 ? 'right' : 'center'}>
                    {index === 0 ? cell.label : cell.value}
                  </Table.Td>
                ))}
              </Table.Tr>
            </Table.Tfoot>
          ) : null}
        </Table>
      </div>

      <Text size="xs" c="dimmed" className={classes.docFooter}>
        این سند توسط سامانه مدیریت مرکزی AlazCore تولید شده است.
      </Text>
    </Stack>
  );
}
