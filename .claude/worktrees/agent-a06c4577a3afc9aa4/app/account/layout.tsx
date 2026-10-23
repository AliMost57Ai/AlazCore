import { redirect } from 'next/navigation';
import { Anchor, Breadcrumbs, Card, Grid, GridCol, Group, Text, Title } from '@mantine/core';
import AccountNav from '@/components/account/AccountNav';
import LogoutButton from '@/components/account/LogoutButton';
import { requireSession } from '@/lib/auth';
import classes from '../page.module.css';

/**
 * The customer account area shell: guard (staff are sent to the admin panel),
 * page chrome, and the sub-navigation linking the three account pages —
 * profile (/account), orders (/account/orders) and password
 * (/account/password) — in a side box. In RTL the first grid column is the
 * right one, so the nav sits on the right of the page content.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession('/account');

  if (session.role !== 'customer') {
    redirect('/dashboard');
  }

  return (
    <div className={classes.page}>
      <div className={classes.wrap}>
        <Breadcrumbs mb="sm">
          <Anchor href="/" size="sm">
            فروشگاه
          </Anchor>
          <Text size="sm" c="dimmed">
            پروفایل
          </Text>
        </Breadcrumbs>

        <Group justify="space-between" wrap="nowrap" mb="md" align="flex-start">
          <div>
            <Title order={1} fz="h2">
              {session.name}
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              خوش آمدید.
            </Text>
          </div>
          <LogoutButton />
        </Group>

        <Grid gutter="md">
          <GridCol span={{ base: 12, sm: 3 }}>
            <Card withBorder padding="xs">
              <AccountNav />
            </Card>
          </GridCol>
          <GridCol span={{ base: 12, sm: 9 }}>{children}</GridCol>
        </Grid>
      </div>
    </div>
  );
}
