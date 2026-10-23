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
  getCategorySeries,
  getRevenueGrowth,
  getRevenueSeries,
  getStatTiles,
  type SeriesPoint,
  type StatTile,
} from '@/lib/stats';

export const metadata: Metadata = { title: 'probe' };

interface ProbeData {
  tiles: StatTile[];
  revenueSeries: SeriesPoint[];
  revenueGrowth: number;
  categorySeries: SeriesPoint[];
  recentOrders: Awaited<ReturnType<typeof listOrders>>;
}

function GridBlock({ data }: { data: ProbeData }) {
  return (
    <Grid gutter={{ base: 'sm', sm: 'md' }}>
      <GridCol span={{ base: 12, lg: 8 }}>
        <RevenueCard series={data.revenueSeries} growth={data.revenueGrowth} />
      </GridCol>
      <GridCol span={{ base: 12, lg: 4 }}>
        <CategoryCard series={data.categorySeries} />
      </GridCol>
    </Grid>
  );
}

async function ProbePage({ searchParams }: { searchParams: { piece?: string } }) {
  await requireSession('/probe');
  const piece = searchParams.piece ?? 'header';

  // Only query what the requested piece actually renders.
  const data: ProbeData =
    piece === 'page'
      ? {
          tiles: await getStatTiles(),
          revenueSeries: await getRevenueSeries(),
          revenueGrowth: await getRevenueGrowth(),
          categorySeries: await getCategorySeries(),
          recentOrders: await listOrders(5),
        }
      : {
          tiles: piece === 'stats' ? await getStatTiles() : [],
          revenueSeries: piece === 'revenue' ? await getRevenueSeries() : [],
          revenueGrowth: piece === 'revenue' ? await getRevenueGrowth() : 0,
          categorySeries: piece === 'category' ? await getCategorySeries() : [],
          recentOrders: piece === 'orders' ? await listOrders(5) : [],
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
        <RevenueCard series={data.revenueSeries} growth={data.revenueGrowth} />
      ) : null}
      {piece === 'category' ? <CategoryCard series={data.categorySeries} /> : null}
      {piece === 'orders' ? <OrdersTable orders={data.recentOrders} /> : null}
    </>
  );
}

export default ProbePage;
