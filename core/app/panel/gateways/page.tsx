import { requireApiMenu } from '@/lib/auth';
import prisma from '@/lib/db';
import CatalogManager from '@/components/CatalogManager';

export const metadata = { title: 'مدیریت درگاه‌ها' };

/** کاتالوگ درگاه‌های پرداخت آنلاین (ipg) — غیرفعال = فقط تخصیص جدید بسته. */
export default async function GatewaysPage() {
  await requireApiMenu('/panel/gateways');

  const gateways = await prisma.coreGateway.findMany({
    where: { kind: 'ipg' },
    orderBy: { id: 'asc' },
    include: { _count: { select: { bindings: true } } },
  });

  return (
    <CatalogManager
      title="مدیریت درگاه‌ها"
      description="درگاه‌های پرداخت آنلاین. غیرفعال‌کردن فقط از تخصیصِ جدید جلوگیری می‌کند؛ سایت‌هایی که قبلاً درگاه را گرفته‌اند همچنان استفاده می‌کنند."
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
