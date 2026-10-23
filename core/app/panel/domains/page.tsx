import { canOversellDomain, requireSession } from '@/lib/auth';
import prisma from '@/lib/db';
import DomainsClient from './DomainsClient';

export const metadata = { title: 'مدیریت دامین‌ها' };

export default async function DomainsPage() {
  const session = await requireSession();
  const canOversell = await canOversellDomain(session);

  const [domains, plans, templates] = await Promise.all([
    prisma.domain.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        plan: { select: { id: true, name: true, durationDays: true } },
        template: { select: { id: true, name: true } },
        gateways: true,
        smsPanels: true,
      },
    }),
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
    <DomainsClient
      domains={JSON.parse(JSON.stringify(domains))}
      plans={plans}
      templates={templates}
      canOversell={canOversell}
    />
  );
}
