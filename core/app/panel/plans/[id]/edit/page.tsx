import { Breadcrumbs, Anchor, Card, Text } from '@mantine/core';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import prisma from '@/lib/db';
import PlanForm, { type PlanFormRow } from '../../PlanForm';

export const metadata = { title: 'ویرایش پلن' };

type PageProps = { params: Promise<{ id: string }> };

/** صفحه اختصاصی ویرایش پلن — به‌جای مودال (فرم بیش از ۴ فیلد). */
export default async function EditPlanPage({ params }: PageProps) {
  await requireSession();
  const { id } = await params;

  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) {
    notFound();
  }

  const initial = JSON.parse(
    JSON.stringify({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      menus: plan.menus,
      limits: plan.limits,
      isActive: plan.isActive,
      durationDays: plan.durationDays,
      priceMonthly: plan.priceMonthly,
    })
  ) as PlanFormRow;

  return (
    <>
      <Breadcrumbs mb="sm">
        <Anchor href="/panel/plans" size="sm">
          مدیریت پلن‌ها
        </Anchor>
        <Text size="sm" c="dimmed">
          {plan.name}
        </Text>
      </Breadcrumbs>
      <Card padding="lg" withBorder>
        <PlanForm initial={initial} />
      </Card>
    </>
  );
}
