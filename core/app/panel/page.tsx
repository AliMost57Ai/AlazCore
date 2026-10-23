import {
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconTicket,
  IconWorldWww,
  IconShieldHalf,
} from '@tabler/icons-react';
import { requireSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { faDate } from '@/lib/format';

export const metadata = { title: 'داشبورد' };

export default async function PanelDashboardPage() {
  await requireSession();

  const [domains, plans, templates, openTickets] = await Promise.all([
    prisma.domain.findMany({
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { name: true } } },
    }),
    prisma.plan.count(),
    prisma.template.count({ where: { isActive: true } }),
    prisma.ticket.count({ where: { status: { in: ['open', 'pending'] } } }),
  ]);

  const now = new Date();
  const active = domains.filter((d) => d.isActive && d.status === 'active');
  const suspended = domains.filter((d) => d.status === 'suspended' || !d.isActive);
  const expiringSoon = domains.filter(
    (d) =>
      d.planExpiresAt &&
      d.planExpiresAt > now &&
      d.planExpiresAt.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000
  );
  const expired = domains.filter((d) => d.planExpiresAt && d.planExpiresAt <= now);

  const tiles = [
    { label: 'دامنه فعال', value: active.length, icon: IconWorldWww, color: 'brand' },
    { label: 'پلن‌های تعریف‌شده', value: plans, icon: IconShieldHalf, color: 'blue' },
    { label: 'تم فعال', value: templates, icon: IconShieldHalf, color: 'grape' },
    { label: 'تیکت باز', value: openTickets, icon: IconTicket, color: 'orange' },
  ];

  return (
    <Stack gap="lg">
      <Title order={2}>سامانه مدیریت مشتریان</Title>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        {tiles.map((tile) => (
          <Card key={tile.label} padding="lg">
            <Group justify="space-between" wrap="nowrap">
              <Stack gap={0}>
                <Text size="sm" c="dimmed">
                  {tile.label}
                </Text>
                <Text size="h1" fw={800}>
                  {tile.value.toLocaleString('en-US')}
                </Text>
              </Stack>
              <ThemeIcon size={52} radius="md" variant="light" color={tile.color}>
                <tile.icon size={26} stroke={1.6} />
              </ThemeIcon>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      {(expiringSoon.length > 0 || expired.length > 0 || suspended.length > 0) ? (
        <Card padding="lg" withBorder>
          <Group gap="sm" mb="sm">
            <ThemeIcon size={36} radius="md" variant="light" color="crimson">
              <IconAlertTriangle size={20} stroke={1.6} />
            </ThemeIcon>
            <Title order={4}>هشدارهای اعتبار</Title>
          </Group>
          <Stack gap="xs">
            {expired.map((d) => (
              <Group key={d.id} justify="space-between">
                <Text size="sm">
                  <strong>{d.domain}</strong> — اعتبار به پایان رسیده ({faDate(d.planExpiresAt)})
                </Text>
                <Badge color="crimson" variant="light">
                  منقضی
                </Badge>
              </Group>
            ))}
            {expiringSoon.map((d) => (
              <Group key={d.id} justify="space-between">
                <Text size="sm">
                  <strong>{d.domain}</strong> — انقضا نزدیک است ({faDate(d.planExpiresAt)})
                </Text>
                <Badge color="orange" variant="light">
                  کمتر از ۳۰ روز
                </Badge>
              </Group>
            ))}
            {suspended.map((d) => (
              <Group key={d.id} justify="space-between">
                <Text size="sm">
                  <strong>{d.domain}</strong> — {d.status === 'suspended' ? 'تعلیق‌شده' : 'غیرفعال'}
                </Text>
                <Badge color="gray" variant="light">
                  خارج از سرویس
                </Badge>
              </Group>
            ))}
          </Stack>
        </Card>
      ) : null}

      <Card padding="lg" withBorder>
        <Title order={4} mb="md">
          آخرین دامنه‌های ثبت‌شده
        </Title>
        <Stack gap="sm">
          {domains.slice(0, 8).map((d) => (
            <Group key={d.id} justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                <Text fw={600} truncate>
                  {d.domain}
                </Text>
                <Badge size="sm" variant="light" color={d.plan ? 'blue' : 'gray'}>
                  {d.plan?.name ?? 'بدون پلن'}
                </Badge>
              </Group>
              <Group gap="xs" wrap="nowrap">
                <Text size="xs" c="dimmed">
                  {faDate(d.createdAt)}
                </Text>
                <Badge
                  size="sm"
                  variant="light"
                  color={
                    !d.isActive || d.status !== 'active'
                      ? 'crimson'
                      : d.planExpiresAt && d.planExpiresAt <= now
                        ? 'orange'
                        : 'green'
                  }
                >
                  {!d.isActive || d.status !== 'active'
                    ? 'خارج از سرویس'
                    : d.planExpiresAt && d.planExpiresAt <= now
                      ? 'منقضی'
                      : 'فعال'}
                </Badge>
              </Group>
            </Group>
          ))}
          {domains.length === 0 ? (
            <Text size="sm" c="dimmed">
              هنوز دامنه‌ای ثبت نشده است — از «مدیریت دامین‌ها» شروع کنید.
            </Text>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  );
}
