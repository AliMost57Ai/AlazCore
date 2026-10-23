import { Card, Group, Progress, Stack, Text } from '@mantine/core';
import { currentDomain, getLicense } from '@/lib/core-license';
import { enNumber } from '@/lib/format';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * نوار پیشرفت اعتبار پلن Core در داشبورد مالک — روز سپری‌شده، کل بازه و
 * روز باقی‌مانده تا انقضا. فقط وقتی هر دو سرِ بازه در payload لایسنس هست
 * رندر می‌شود (پلن بدون تاریخ = نوار نمی‌گیرد). داده از API اعتبارسنجی
 * Core می‌آید (کش ۵ دقیقه‌ای)، نه خواندن مستقیم دیتابیس Core.
 */
export default async function PlanValidityBar() {
  const license = await getLicense(await currentDomain());
  const plan = license?.plan;
  if (!license?.ok || !plan?.expiresAt || !plan.startsAt) {
    return null;
  }

  const startsAt = new Date(plan.startsAt).getTime();
  const expiresAt = new Date(plan.expiresAt).getTime();
  if (!Number.isFinite(startsAt) || !Number.isFinite(expiresAt) || expiresAt <= startsAt) {
    return null;
  }

  const now = Date.now();
  const totalDays = Math.max(1, Math.round((expiresAt - startsAt) / DAY_MS));
  // روز شمارش از ۱ شروع می‌شود — روز اولِ اعتبار «یک روز سپری‌شده» است.
  const elapsedDays = Math.min(totalDays, Math.max(1, Math.ceil((now - startsAt) / DAY_MS)));
  const remainingDays = Math.max(0, Math.ceil((expiresAt - now) / DAY_MS));
  const percent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
  const urgent = remainingDays <= 7;

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={700}>
            اعتبار پلن «{plan.name}»
          </Text>
          <Text size="sm" fw={700} c={urgent ? 'red.7' : 'dimmed'}>
            {remainingDays > 0 ? `${enNumber(remainingDays)} روز باقی‌مانده` : 'منقضی شده'}
          </Text>
        </Group>
        <Progress value={percent} size="md" radius="sm" color={urgent ? 'red' : 'brand'} />
        <Group justify="space-between" wrap="nowrap">
          <Text size="xs" c="dimmed">
            {enNumber(elapsedDays)} روز سپری شده از {enNumber(totalDays)} روز
          </Text>
          <Text size="xs" c="dimmed">
            تا {new Date(plan.expiresAt).toLocaleDateString('fa-IR-u-ca-persian')}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}
