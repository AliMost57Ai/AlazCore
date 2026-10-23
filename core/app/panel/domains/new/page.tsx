import { Breadcrumbs, Anchor, Card, Text } from '@mantine/core';
import { canOversellDomain, requireSession } from '@/lib/auth';
import prisma from '@/lib/db';
import DomainForm from '../DomainForm';

export const metadata = { title: 'تعریف دامنه جدید' };

/** صفحه اختصاصی تعریف دامنه — فرم‌های بیش از ۴ فیلد مودال باز نمی‌شوند. */
export default async function NewDomainPage() {
  const session = await requireSession();
  const canOversell = await canOversellDomain(session);

  const [plans, templates] = await Promise.all([
    prisma.plan.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.template.findMany({
      where: { isActive: true },
      select: { id: true, name: true, key: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <>
      <Breadcrumbs mb="sm">
        <Anchor href="/panel/domains" size="sm">
          مدیریت دامین‌ها
        </Anchor>
        <Text size="sm" c="dimmed">
          دامنه جدید
        </Text>
      </Breadcrumbs>
      <Card padding="lg" withBorder>
        <DomainForm plans={plans} templates={templates} canOversell={canOversell} />
      </Card>
    </>
  );
}
