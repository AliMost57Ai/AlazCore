import { requireSession } from '@/lib/auth';
import prisma from '@/lib/db';
import TemplatesClient from './TemplatesClient';

export const metadata = { title: 'مدیریت تم‌ها' };

export default async function TemplatesPage() {
  await requireSession();

  const templates = await prisma.template.findMany({
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    include: { _count: { select: { domains: true } } },
  });

  return <TemplatesClient templates={JSON.parse(JSON.stringify(templates))} />;
}
