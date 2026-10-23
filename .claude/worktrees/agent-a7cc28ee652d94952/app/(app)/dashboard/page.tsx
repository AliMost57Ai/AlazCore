import type { Metadata } from 'next';
import { Card, Grid, GridCol, Group, Select, Stack, Text } from '@mantine/core';
import AllOrdersButton from '@/components/dashboard/AllOrdersButton';
import CategoryCard from '@/components/dashboard/CategoryCard';
import OrdersTable from '@/components/dashboard/OrdersTable';
import RevenueCard from '@/components/dashboard/RevenueCard';
import StaffWelcome from '@/components/dashboard/StaffWelcome';
import StatsGrid from '@/components/dashboard/StatsGrid';
import PageHeader from '@/components/layout/PageHeader';
import { hasAdminAccess, requireSession } from '@/lib/auth';
import { listOrders } from '@/lib/orders';
import { effectivePermissions } from '@/lib/session';
import { getCategorySeries, getRevenueGrowth, getRevenueSeries, getStatTiles } from '@/lib/stats';

export const metadata: Metadata = {
  title: 'داشبورد',
};

export default async function DashboardPage() {
  const session = await requireSession('/dashboard');
  const firstName = session.name.split(' ')[0];

  // The store-wide picture — revenue, the category mix, every customer's latest
  // orders — is the owner's, so a staff member with a couple of menus gets a
  // greeting and their own shortcuts instead. This returns *before* the queries
  // below on purpose: numbers that must not be shown should not be fetched
  // either, or the next careless edit to this page leaks them.
  if (!hasAdminAccess(session)) {
    return <StaffWelcome firstName={firstName} perms={effectivePermissions(session)} />;
  }

  // One round of parallel queries for everything the page renders.
  const [tiles, revenueSeries, revenueGrowth, categorySeries, recentOrders] = await Promise.all([
    getStatTiles(),
    getRevenueSeries(),
    getRevenueGrowth(),
    getCategorySeries(),
    listOrders(5),
  ]);

  return (
    <Stack gap="lg">
      <PageHeader
        title={`سلام ${firstName} 👋`}
        description="خلاصه وضعیت فروشگاه شما در یک نگاه."
        actions={
          // Filters sit in one row above the charts.
          <Select
            data={[
              { value: '30', label: '۳۰ روز گذشته' },
              { value: '90', label: '۹۰ روز گذشته' },
              { value: '365', label: 'یک سال گذشته' },
            ]}
            defaultValue="365"
            allowDeselect={false}
            size="sm"
            radius="md"
            w={{ base: '100%', xs: 170 }}
            aria-label="بازه زمانی"
          />
        }
      />

      <StatsGrid tiles={tiles} />

      <Grid gutter={{ base: 'sm', sm: 'md' }}>
        {/* GridCol is imported directly: this is a server component, and the
            Grid.Col static property is not reachable on a client reference. */}
        <GridCol span={{ base: 12, lg: 8 }}>
          <RevenueCard series={revenueSeries} growth={revenueGrowth} />
        </GridCol>
        <GridCol span={{ base: 12, lg: 4 }}>
          <CategoryCard series={categorySeries} />
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
  );
}
