import { Suspense } from 'react';
import { Card, Stack, Text } from '@mantine/core';
import ReportDocument from '@/components/ReportDocument';
import { requireApiMenu } from '@/lib/auth';
import prisma from '@/lib/db';
import { faDate } from '@/lib/format';
import ReportFilterBar from '../ReportFilterBar';

export const metadata = { title: 'گزارش تمدیدها' };
export const dynamic = 'force-dynamic';

/**
 * گزارش ۵ — سوابق تمدید اعتبار دامنه‌ها: هر تمدید یک ردیف PlanAssignment
 * (دیتابیس خود Core). فیلتر دامنه و بازه تاریخ ثبت.
 */
export default async function RenewalsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireApiMenu('/panel/reports/renewals');
  const params = await searchParams;
  const one = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === 'string' && value ? value : undefined;
  };
  const domainFilter = one('domain');
  const from = one('from');
  const to = one('to');

  const domains = await prisma.domain.findMany({
    where: { isActive: true },
    orderBy: { domain: 'asc' },
    select: { domain: true },
  });

  const rows = await prisma.planAssignment.findMany({
    where: {
      ...(domainFilter ? { domain: { is: { domain: domainFilter } } } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      domain: { select: { domain: true, ownerName: true } },
      plan: { select: { name: true } },
    },
    take: 500,
  });

  const filtersSummary = [
    domainFilter ? `دامنه: ${domainFilter}` : 'دامنه: همه سایت‌ها',
    from ? `از: ${from}` : null,
    to ? `تا: ${to}` : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <Stack gap="lg">
      <Card padding="lg" withBorder className="no-print">
        <Suspense>
          <ReportFilterBar
            domains={domains.map((d) => ({ domain: d.domain, ready: true }))}
            categories={[]}
            showCategory={false}
            showProduct={false}
          />
        </Suspense>
      </Card>

      <ReportDocument
        title="گزارش تمدیدهای اعتبار"
        exportHref="/api/reports/renewals/export"
        filtersSummary={filtersSummary}
        headers={['دامنه', 'پلن', 'شروع دوره', 'پایان دوره', 'تاریخ ثبت']}
      >
        {rows.map((row) => (
          <tr key={row.id}>
            <td style={{ fontWeight: 600 }}>
              {row.domain.domain}
              <Text component="span" size="xs" c="dimmed" style={{ marginInlineStart: 6 }}>
                {row.domain.ownerName}
              </Text>
            </td>
            <td>{row.plan.name}</td>
            <td style={{ textAlign: 'center' }}>{faDate(row.startsAt)}</td>
            <td style={{ textAlign: 'center' }}>{faDate(row.endsAt)}</td>
            <td style={{ textAlign: 'center' }}>{faDate(row.createdAt)}</td>
          </tr>
        ))}
      </ReportDocument>
    </Stack>
  );
}
