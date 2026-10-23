import { requireApiMenu } from '@/lib/auth';
import prisma from '@/lib/db';
import CatalogManager from '@/components/CatalogManager';

export const metadata = { title: 'مدیریت درگاه‌های اقساطی' };

/** کاتالوگ درگاه‌های اقساطی (bnpl). */
export default async function BnplPage() {
  await requireApiMenu('/panel/bnpl');

  const gateways = await prisma.coreGateway.findMany({
    where: { kind: 'bnpl' },
    orderBy: { id: 'asc' },
    include: { _count: { select: { bindings: true } } },
  });

  return (
    <CatalogManager
      title="مدیریت درگاه‌های اقساطی"
      description="درگاه‌های خرید اقساطی (BNPL). غیرفعال‌کردن فقط از تخصیصِ جدید جلوگیری می‌کند؛ سایت‌هایی که قبلاً گرفته‌اند همچنان استفاده می‌کنند."
      rows={gateways.map((g) => ({
        id: g.id,
        label: g.label,
        isActive: g.isActive,
        logoPath: g.logoPath,
        usageCount: g._count.bindings,
      }))}
      apiBase="/api/catalog/gateways"
    />
  );
}
