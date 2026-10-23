import { redirect } from 'next/navigation';
import { IconListDetails } from '@tabler/icons-react';
import { Box, Card, Group, Stack, Text } from '@mantine/core';
import EmptyState from '@/components/layout/EmptyState';
import ExportButton from '@/components/layout/ExportButton';
import PageHeader from '@/components/layout/PageHeader';
import PrintButton from '@/components/layout/PrintButton';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { enNumber } from '@/lib/format';
import { reorderList } from '@/lib/stock';
import classes from '../stock-table.module.css';

export const metadata = { title: 'لیست خرید' };
export const dynamic = 'force-dynamic';

/**
 * کالاهایی که موجودی‌شان به نقطه سفارش رسیده — برای سفارش مجدد به تامین‌کننده.
 * ستون «کسری موجودی» صرفاً نمایش threshold − qty از داده‌های همین ردیف‌هاست؛
 * فرآیند جدیدی نیست. دسکتاپ جدول، موبایل کارت (کانسپت یکسان با سفارش‌ها).
 */
export default async function ReorderListPage() {
  const session = await requireSession('/products/reorder-list');
  if (!canAccessMenu(session, '/products/reorder-list')) {
    redirect('/dashboard');
  }
  const rows = await reorderList();

  return (
    <Stack gap="lg">
      <PageHeader
        title="لیست خرید"
        description={
          rows.length > 0
            ? `${enNumber(rows.length)} کالا به نقطه سفارش رسیده — آماده سفارش به تأمین‌کننده`
            : 'کالاهایی که موجودی‌شان به نقطه سفارش رسیده است'
        }
        actions={
          <Group gap="xs" className={classes.actions}>
            <PrintButton />
            <ExportButton href="/api/export/stock/reorder-list" />
          </Group>
        }
      />

      <Card padding="lg" withBorder>
        {rows.length === 0 ? (
          <EmptyState
            icon={IconListDetails}
            message="چیزی برای خرید نیست."
            hint="موجودی هیچ کالایی به نقطه سفارش نرسیده است."
          />
        ) : (
          <>
            {/* Desktop: جدول پنل با سربرگ recessive — هم‌سان جدول سفارش‌ها. */}
            <Box visibleFrom="sm" className={classes.tableHolder}>
              <table className={classes.table}>
                <thead>
                  <tr>
                    <th>کالا</th>
                    <th className={classes.center}>موجودی فعلی</th>
                    <th className={classes.center}>نقطه سفارش</th>
                    <th className={classes.center}>کسری موجودی</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className={classes.name}>{row.name}</td>
                      <td
                        className={`${classes.center} ${
                          row.qty <= 0 ? classes.negative : classes.low
                        }`}
                      >
                        <span className={classes.dot} aria-hidden />
                        {enNumber(row.qty)}
                      </td>
                      <td className={classes.center}>{enNumber(row.threshold)}</td>
                      <td className={`${classes.center} ${classes.shortfall}`}>
                        {enNumber(row.threshold - row.qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>

            {/* Mobile: کارت هر کالا — جدول چهارستونه روی ۳۹۰px خوانا نیست. */}
            <Stack gap="sm" hiddenFrom="sm" className={classes.cards}>
              {rows.map((row) => (
                <Card key={row.id} padding="sm" radius="md">
                  <Text size="sm" fw={600} mb={6}>
                    {row.name}
                  </Text>
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Text size="xs" c="dimmed">
                      موجودی فعلی
                    </Text>
                    <Text size="sm" className={row.qty <= 0 ? classes.negative : classes.low}>
                      <span className={classes.dot} aria-hidden />
                      {enNumber(row.qty)}
                    </Text>
                  </Group>
                  <Group justify="space-between" wrap="nowrap" gap="xs" mt={4}>
                    <Text size="xs" c="dimmed">
                      نقطه سفارش
                    </Text>
                    <Text size="sm" className={classes.center}>
                      {enNumber(row.threshold)}
                    </Text>
                  </Group>
                  <Group justify="space-between" wrap="nowrap" gap="xs" mt={4}>
                    <Text size="xs" c="dimmed">
                      کسری موجودی
                    </Text>
                    <Text size="sm" className={classes.shortfall}>
                      {enNumber(row.threshold - row.qty)}
                    </Text>
                  </Group>
                </Card>
              ))}
            </Stack>
          </>
        )}
      </Card>
    </Stack>
  );
}
