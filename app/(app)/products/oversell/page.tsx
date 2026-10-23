import { redirect } from 'next/navigation';
import { IconPackages } from '@tabler/icons-react';
import { Box, Card, Group, Stack, Text } from '@mantine/core';
import EmptyState from '@/components/layout/EmptyState';
import ExportButton from '@/components/layout/ExportButton';
import PageHeader from '@/components/layout/PageHeader';
import PrintButton from '@/components/layout/PrintButton';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { enNumber } from '@/lib/format';
import { oversellList } from '@/lib/stock';
import classes from '../stock-table.module.css';

export const metadata = { title: 'خالی‌فروشی' };
export const dynamic = 'force-dynamic';

/**
 * کالاهای دارای مجوز خالی‌فروشی که موجودی‌شان صفر یا منفی شده — در ویترین
 * با برچسب «تنها ۱ عدد باقی مانده» قابل خریدند و سقفشان در ثبت سفارش کنترل
 * می‌شود. شمار این صفحه همان عدد باکس داشبورد و badge/zنگ اعلان‌هاست.
 * دسکتاپ جدول، موبایل کارت (کانسپت یکسان با سفارش‌ها).
 */
export default async function OversellPage() {
  const session = await requireSession('/products/oversell');
  if (!canAccessMenu(session, '/products/oversell')) {
    redirect('/dashboard');
  }
  const rows = await oversellList();

  return (
    <Stack gap="lg">
      <PageHeader
        title="خالی‌فروشی"
        description={
          rows.length > 0
            ? `${enNumber(rows.length)} کالا موجودی‌شان تمام شده و با مجوز خالی‌فروشی در ویترین فروخته می‌شوند`
            : 'کالاهای دارای مجوز خالی‌فروشی که موجودی‌شان تمام شده است'
        }
        actions={
          <Group gap="xs" className={classes.actions}>
            <PrintButton />
            <ExportButton href="/api/export/stock/oversell" />
          </Group>
        }
      />

      <Card padding="lg" withBorder>
        {rows.length === 0 ? (
          <EmptyState
            icon={IconPackages}
            message="هیچ کالایی در وضعیت خالی‌فروشی نیست."
            hint="کالاهای دارای مجوز خالی‌فروشی وقتی موجودی‌شان صفر یا منفی شود اینجا فهرست می‌شوند."
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
                    <th className={classes.center}>واحد فروخته‌شده (کسری)</th>
                    <th className={classes.center}>سقف خالی‌فروشی کالا</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className={classes.name}>{row.name}</td>
                      <td
                        className={`${classes.center} ${
                          row.qty < 0 ? classes.negative : classes.low
                        }`}
                      >
                        <span className={classes.dot} aria-hidden />
                        {enNumber(row.qty)}
                      </td>
                      <td
                        className={
                          row.qty < 0 ? `${classes.center} ${classes.negative}` : classes.center
                        }
                      >
                        {enNumber(Math.max(0, -row.qty))}
                      </td>
                      <td className={classes.center}>
                        {row.oversellMax !== null ? (
                          enNumber(row.oversellMax)
                        ) : (
                          <span className={classes.capGlobal}>سقف کل فروشگاه</span>
                        )}
                      </td>
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
                    <Text size="sm" className={row.qty < 0 ? classes.negative : classes.low}>
                      <span className={classes.dot} aria-hidden />
                      {enNumber(row.qty)}
                    </Text>
                  </Group>
                  <Group justify="space-between" wrap="nowrap" gap="xs" mt={4}>
                    <Text size="xs" c="dimmed">
                      واحد فروخته‌شده (کسری)
                    </Text>
                    <Text size="sm" className={row.qty < 0 ? classes.negative : undefined}>
                      {enNumber(Math.max(0, -row.qty))}
                    </Text>
                  </Group>
                  <Group justify="space-between" wrap="nowrap" gap="xs" mt={4}>
                    <Text size="xs" c="dimmed">
                      سقف خالی‌فروشی کالا
                    </Text>
                    {row.oversellMax !== null ? (
                      <Text size="sm" className={classes.center}>
                        {enNumber(row.oversellMax)}
                      </Text>
                    ) : (
                      <Text size="xs" className={classes.capGlobal}>
                        سقف کل فروشگاه
                      </Text>
                    )}
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
