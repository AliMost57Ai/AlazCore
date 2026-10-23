import { Breadcrumbs, Anchor, Card, Text } from '@mantine/core';
import { notFound } from 'next/navigation';
import { canOversellDomain, requireSession } from '@/lib/auth';
import prisma from '@/lib/db';
import DomainForm, { type DomainFormRow } from '../../DomainForm';
import SiteAdminCard from './SiteAdminCard';

export const metadata = { title: 'ویرایش دامنه' };

type PageProps = { params: Promise<{ id: string }> };

/** صفحه اختصاصی ویرایش دامنه — به‌جای مودال (فرم بیش از ۴ فیلد). */
export default async function EditDomainPage({ params }: PageProps) {
  const session = await requireSession();
  const canOversell = await canOversellDomain(session);
  const { id } = await params;

  const domain = await prisma.domain.findUnique({
    where: { id },
    select: {
      id: true,
      domain: true,
      ownerName: true,
      ownerPhone: true,
      ownerEmail: true,
      techName: true,
      techPhone: true,
      techEmail: true,
      planId: true,
      planExpiresAt: true,
      isActive: true,
      status: true,
      notes: true,
      templateId: true,
      dbName: true,
      dbStatus: true,
      commissionPercent: true,
      oversellAllowed: true,
      oversellMax: true,
      inPersonDelivery: true,
    },
  });

  if (!domain) {
    notFound();
  }

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

  const initial = JSON.parse(JSON.stringify(domain)) as DomainFormRow;

  return (
    <>
      <Breadcrumbs mb="sm">
        <Anchor href="/panel/domains" size="sm">
          مدیریت دامین‌ها
        </Anchor>
        <Text size="sm" c="dimmed" dir="ltr">
          {domain.domain}
        </Text>
      </Breadcrumbs>
      <Card padding="lg" withBorder>
        <DomainForm
          plans={plans}
          templates={templates}
          canOversell={canOversell}
          initial={initial}
        />
      </Card>
      {/* اعتبارنامه ادمین سایت — نمایش/بازنشانی (زیر فرم، همان صفحه اختصاصی). */}
      <SiteAdminCard domainId={domain.id} dbStatus={domain.dbStatus ?? 'pending'} />
    </>
  );
}
