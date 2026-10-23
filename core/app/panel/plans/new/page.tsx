import { Breadcrumbs, Anchor, Card, Text } from '@mantine/core';
import { requireSession } from '@/lib/auth';
import PlanForm from '../PlanForm';

export const metadata = { title: 'تعریف پلن جدید' };

/** صفحه اختصاصی تعریف پلن — فرم‌های بیش از ۴ فیلد مودال باز نمی‌شوند. */
export default async function NewPlanPage() {
  await requireSession();

  return (
    <>
      <Breadcrumbs mb="sm">
        <Anchor href="/panel/plans" size="sm">
          مدیریت پلن‌ها
        </Anchor>
        <Text size="sm" c="dimmed">
          پلن جدید
        </Text>
      </Breadcrumbs>
      <Card padding="lg" withBorder>
        <PlanForm />
      </Card>
    </>
  );
}
