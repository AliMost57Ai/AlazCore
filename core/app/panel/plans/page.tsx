import { requireSession } from '@/lib/auth';
import prisma from '@/lib/db';
import PlansClient from './PlansClient';

export const metadata = { title: 'مدیریت پلن‌ها' };

export default async function PlansPage() {
  await requireSession();

  const plans = await prisma.plan.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { domains: true } } },
  });

  return <PlansClient plans={JSON.parse(JSON.stringify(plans))} />;
}
