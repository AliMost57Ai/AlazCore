import { redirect } from 'next/navigation';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Box, Card, Group, Stack, Text } from '@mantine/core';
import EmptyState from '@/components/layout/EmptyState';
import ExportButton from '@/components/layout/ExportButton';
import PageHeader from '@/components/layout/PageHeader';
import PrintButton from '@/components/layout/PrintButton';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { enNumber } from '@/lib/format';
import { lowStockList } from '@/lib/stock';
import classes from '../stock-table.module.css';

export const metadata = { title: 'رو به اتمام' };
export const dynamic = 'force-dynamic';

/** کالاهایی که موجودی‌شان به حداقل رسیده یا کمتر است — دسکتاپ جدول، موبایل کارت. */
export default async function LowStockPage() {
  const session = await requireSession('/products/low-stock');
  if (!canAccessMenu(session, '/products/low-stock')) {
    redirect('/dashboard');
  }
  const rows = await lowStockList();

  return (
    <Stack gap="lg">
      <PageHeader
        title="رو به اتمام"
        description={
          rows.length > 0
            ? `${enNumber(rows.length)} کالا به حداقل موجودی رسیده یا کمتر است`
            : 'کالاهایی که موجودی‌شان به حداقل رسیده یا کمتر است'
        }
        actions={
          <Group gap="xs" className={classes.actions}>
            <PrintButton />
            <ExportButton href="/api/export/stock/low-stock" />
          </Group>
        }
      />

      <Card padding="lg" withBorder>
        {rows.length === 0 ? (
          <EmptyState
            icon={IconAlertTriangle}
            message="همه کالاها بالاتر از حداقل موجودی‌اند."
            hint="وقتی موجودی کالایی به حداقل برسد، همین‌جا هشدار داده می‌شود."
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
                    <th className={classes.center}>حداقل موجودی</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>

            {/* Mobile: کارت هر کالا — کانسپت کارت سفارش‌ها. */}
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
                      حداقل موجودی
                    </Text>
                    <Text size="sm" className={classes.center}>
                      {enNumber(row.threshold)}
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
