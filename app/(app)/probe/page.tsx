import type { Metadata } from 'next';
import { Card, Grid, GridCol, Group, Select, Stack, Text } from '@mantine/core';
import AllOrdersButton from '@/components/dashboard/AllOrdersButton';
import CategoryCard from '@/components/dashboard/CategoryCard';
import OrdersTable from '@/components/dashboard/OrdersTable';
import RevenueCard from '@/components/dashboard/RevenueCard';
import StatsGrid from '@/components/dashboard/StatsGrid';
import PageHeader from '@/components/layout/PageHeader';
import { requireSession } from '@/lib/auth';
import { listOrders } from '@/lib/orders';
import {
  getMonthlyRevenue,
  getRevenueDailySeries,
  getRevenueWeeklySeries,
  getSalesBreakdown,
  getStatTiles,
  type MonthlyRevenue,
  type SalesBreakdown,
  type StatTile,
} from '@/lib/stats';

export const metadata: Metadata = { title: 'probe' };

interface ProbeData {
  tiles: StatTile[];
  monthly: MonthlyRevenue;
  daily: { label: string; value: number; hint?: string }[];
  weekly: { label: string; value: number; hint?: string }[];
  breakdown: SalesBreakdown;
  recentOrders: Awaited<ReturnType<typeof listOrders>>;
}

function GridBlock({ data }: { data: ProbeData }) {
  return (
    <Grid gutter={{ base: 'sm', sm: 'md' }}>
      <GridCol span={{ base: 12, lg: 8 }}>
        <RevenueCard daily={data.daily} weekly={data.weekly} monthly={data.monthly} />
      </GridCol>
      <GridCol span={{ base: 12, lg: 4 }}>
        <CategoryCard breakdown={data.breakdown} />
      </GridCol>
    </Grid>
  );
}

async function ProbePage({ searchParams }: { searchParams: { piece?: string } }) {
  await requireSession('/probe');
  const piece = searchParams.piece ?? 'header';

  // Only query what the requested piece actually renders.
  const wantsStats = piece === 'page' || piece === 'stats';
  const wantsCharts =
    piece === 'page' || piece === 'grid' || piece === 'revenue' || piece === 'category';
  const wantsOrders = piece === 'page' || piece === 'orders';
  const data: ProbeData = {
    tiles: wantsStats ? await getStatTiles() : [],
    monthly: wantsCharts ? await getMonthlyRevenue() : { years: [], byYear: {}, growth: 0 },
    daily: wantsCharts ? await getRevenueDailySeries() : [],
    weekly: wantsCharts ? await getRevenueWeeklySeries() : [],
    breakdown: wantsCharts
      ? await getSalesBreakdown()
      : { categories: [], pickupLocations: [], deliveryMethods: [] },
    recentOrders: wantsOrders ? await listOrders(5) : [],
  };

  if (piece === 'grid') {
    return <GridBlock data={data} />;
  }

  if (piece === 'page') {
    return (
      <Stack gap="lg">
        <PageHeader
          title="سلام"
          description="x"
          actions={
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
        <StatsGrid tiles={data.tiles} />
        <GridBlock data={data} />
        <Card>
          <Group justify="space-between" wrap="wrap" gap="xs" mb="md">
            <Stack gap={2}>
              <Text fw={600}>آخرین سفارشها</Text>
            </Stack>
            <AllOrdersButton />
          </Group>
          <OrdersTable orders={data.recentOrders} />
        </Card>
      </Stack>
    );
  }

  return (
    <>
      {piece === 'header' ? (
        <PageHeader title="سلام" description="x" actions={<AllOrdersButton />} />
      ) : null}
      {piece === 'stats' ? <StatsGrid tiles={data.tiles} /> : null}
      {piece === 'revenue' ? (
        <RevenueCard daily={data.daily} weekly={data.weekly} monthly={data.monthly} />
      ) : null}
      {piece === 'category' ? <CategoryCard breakdown={data.breakdown} /> : null}
      {piece === 'orders' ? <OrdersTable orders={data.recentOrders} /> : null}
    </>
  );
}

export default ProbePage;
