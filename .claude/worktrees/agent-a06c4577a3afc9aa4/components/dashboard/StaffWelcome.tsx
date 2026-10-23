import { Alert, Anchor, Card, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import { MENU_LABELS, TOKEN_ONLY_HREFS } from '@/lib/nav-permissions';

export interface StaffWelcomeProps {
  /** The signed-in user's first name, for the greeting. */
  firstName: string;
  /** Their signed-in menu grants. Never ['*'] — admins get the real dashboard. */
  perms: string[];
}

/**
 * What /dashboard shows a staff member who is not an administrator.
 *
 * The shop's sales charts, revenue totals and latest orders are the owner's
 * numbers, so nothing is queried and nothing is drawn for this account: it gets
 * a greeting and a way into the pages its grants actually open.
 *
 * This page has to exist for everyone — the sign-in form lands here and every
 * refused page redirects here — so it can never be the thing that bounces
 * someone. The guards decide what a session may open; only the drawing is
 * restricted.
 */
export default function StaffWelcome({ firstName, perms }: StaffWelcomeProps) {
  // The stored grants are menu hrefs; the words come from the same catalog the
  // /roles page and the system log read, so they cannot drift apart.
  // '/customers/file' is a capability, not a route — a link to it would 404.
  const links = perms
    .filter((href) => MENU_LABELS[href] !== undefined && !TOKEN_ONLY_HREFS.includes(href))
    .map((href) => ({ href, label: MENU_LABELS[href] }));

  return (
    <Stack gap="lg">
      <PageHeader title={`سلام ${firstName} 👋`} description="به پنل مدیریت خوش آمدید." />

      <Card>
        <Text fw={600} mb={4}>
          دسترسی‌های شما
        </Text>
        <Text size="sm" c="dimmed" mb="lg">
          نمودارها و آمار فروش داشبورد فقط برای مدیران نمایش داده می‌شود. صفحه‌هایی که برای شما
          تعیین شده از اینجا در دسترس است.
        </Text>

        {links.length > 0 ? (
          <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing="xs">
            {links.map((link) => (
              <Paper key={link.href} withBorder radius="md" p="sm">
                <Anchor href={link.href} size="sm" fw={500}>
                  {link.label}
                </Anchor>
              </Paper>
            ))}
          </SimpleGrid>
        ) : (
          <Alert color="gray" variant="light" title="هنوز دسترسی‌ای برای شما ثبت نشده است">
            برای تعیین دسترسی‌های خود با مدیر سیستم تماس بگیرید.
          </Alert>
        )}

        <Text size="sm" mt="lg">
          <Anchor href="/settings" size="sm">
            حساب کاربری و تنظیمات نمایش
          </Anchor>
        </Text>
      </Card>
    </Stack>
  );
}
