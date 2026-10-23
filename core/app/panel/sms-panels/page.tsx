import { requireApiMenu } from '@/lib/auth';
import prisma from '@/lib/db';
import CatalogManager from '@/components/CatalogManager';

export const metadata = { title: 'مدیریت پنل پیامکی' };

/** کاتالوگ پنل‌های پیامکی. */
export default async function SmsPanelsPage() {
  await requireApiMenu('/panel/sms-panels');

  const panels = await prisma.coreSmsPanel.findMany({
    orderBy: { id: 'asc' },
    include: { _count: { select: { bindings: true } } },
  });

  return (
    <CatalogManager
      title="مدیریت پنل پیامکی"
      description="پنل‌های پیامکی. غیرفعال‌کردن فقط از تخصیصِ جدید جلوگیری می‌کند؛ سایت‌هایی که قبلاً پنل را گرفته‌اند همچنان استفاده می‌کنند."
      rows={panels.map((p) => ({
        id: p.id,
        label: p.label,
        isActive: p.isActive,
        logoPath: p.logoPath,
        usageCount: p._count.bindings,
      }))}
      apiBase="/api/catalog/sms"
    />
  );
}
