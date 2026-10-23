import { requireApiMenu } from '@/lib/auth';
import prisma from '@/lib/db';
import Link from 'next/link';
import { Anchor, Breadcrumbs, Text } from '@mantine/core';
import IntegrationsClient from './IntegrationsClient';

export const metadata = { title: 'درگاه‌ها و پنل‌های پیامکی' };

/**
 * صفحه تخصیص درگاه‌ها/پنل‌های پیامکی به یک دامین — tabular (جای مودال).
 * فقط آیتم‌های فعالِ کاتالوگ در فهرست تخصیص می‌آیند؛ تخصیص‌های قدیمیِ
 * آیتمِ غیرفعال‌شده در بخش جدا نشان داده می‌شوند و همچنان فعال می‌مانند.
 */
export default async function DomainIntegrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireApiMenu('/panel/domains');
  const { id } = await params;

  const domain = await prisma.domain.findUnique({
    where: { id },
    include: { gateways: true, smsPanels: true },
  });
  if (!domain) {
    return <Text c="red" p="md">دامنه یافت نشد.</Text>;
  }

  const [gateways, smsPanels] = await Promise.all([
    prisma.coreGateway.findMany({ orderBy: [{ kind: 'asc' }, { id: 'asc' }] }),
    prisma.coreSmsPanel.findMany({ orderBy: { id: 'asc' } }),
  ]);

  const assignedGateways = new Map(domain.gateways.map((g) => [g.gateway, g.isActive]));
  const assignedSms = new Map(domain.smsPanels.map((s) => [s.provider, s.isActive]));

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
      <IntegrationsClient
        domainId={domain.id}
        domainName={domain.domain}
        gateways={JSON.parse(JSON.stringify(gateways))}
        smsPanels={JSON.parse(JSON.stringify(smsPanels))}
        assignedGateways={Object.fromEntries(assignedGateways)}
        assignedSms={Object.fromEntries(assignedSms)}
      />
    </>
  );
}
