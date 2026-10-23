import type { Metadata } from 'next';
import { Card, Grid, GridCol, Group, Stack, Text } from '@mantine/core';
import AllOrdersButton from '@/components/dashboard/AllOrdersButton';
import CategoryCard from '@/components/dashboard/CategoryCard';
import OrdersTable from '@/components/dashboard/OrdersTable';
import PlanValidityBar from '@/components/dashboard/PlanValidityBar';
import RevenueCard from '@/components/dashboard/RevenueCard';
import StatsGrid from '@/components/dashboard/StatsGrid';
import StockAlertBoxes from '@/components/dashboard/StockAlertBoxes';
import PageHeader from '@/components/layout/PageHeader';
import { requireSession } from '@/lib/auth';
import { listOrders } from '@/lib/orders';
import {
  getMonthlyRevenue,
  getRevenueDailySeries,
  getRevenueWeeklySeries,
  getSalesBreakdown,
  getStatTiles,
  getStockTiles,
} from '@/lib/stats';

export const metadata: Metadata = {
  title: 'داشبورد',
};

export default async function DashboardPage() {
  const session = await requireSession('/dashboard');
  const firstName = session.name.split(' ')[0];

  // One round of parallel queries for everything the page renders.
  const [
    tiles,
    monthlyRevenue,
    dailySeries,
    weeklySeries,
    salesBreakdown,
    recentOrders,
    stockTiles,
  ] = await Promise.all([
    getStatTiles(),
    getMonthlyRevenue(),
    getRevenueDailySeries(),
    getRevenueWeeklySeries(),
    getSalesBreakdown(),
    listOrders(5),
    getStockTiles(),
  ]);

  return (
    <>
      <Stack gap="lg">
        <PageHeader
          title={`سلام ${firstName} 👋`}
          description="خلاصه وضعیت فروشگاه شما در یک نگاه."
        />

        <StatsGrid tiles={tiles} />
        <StockAlertBoxes tiles={stockTiles} />

        <Grid gutter={{ base: 'sm', sm: 'md' }}>
          {/* GridCol is imported directly: this is a server component, and the
            Grid.Col static property is not reachable on a client reference. */}
          <GridCol span={{ base: 12, lg: 8 }}>
            <RevenueCard daily={dailySeries} weekly={weeklySeries} monthly={monthlyRevenue} />
          </GridCol>
          <GridCol span={{ base: 12, lg: 4 }}>
            <CategoryCard breakdown={salesBreakdown} />
          </GridCol>
        </Grid>

        <Card>
          <Group justify="space-between" wrap="wrap" gap="xs" mb="md">
            <Stack gap={2}>
              <Text fw={600}>آخرین سفارش‌ها</Text>
              <Text size="xs" c="dimmed">
                پنج سفارش اخیر
              </Text>
            </Stack>
            <AllOrdersButton />
          </Group>

          <OrdersTable orders={recentOrders} />
        </Card>
      </Stack>
      <Stack gap="lg">
        <PlanValidityBar />
      </Stack>
    </>
  );
}
