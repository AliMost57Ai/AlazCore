import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import CategoriesManager from '@/components/settings/CategoriesManager';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { listCategories } from '@/lib/categories';
import { placementTargets } from '@/lib/section-placements';
import { getActiveThemeId } from '@/lib/theme-settings';
import { THEME_MAP } from '@/lib/themes';

export const metadata: Metadata = {
  title: 'تنظیمات — دسته‌بندی کالا',
};

export const dynamic = 'force-dynamic';

/** Admin-only: product groups + categories (Batch K point 3). */
export default async function CategoriesPage() {
  const session = await requireSession('/settings/categories');

  if (!canAccessMenu(session, '/settings/categories')) {
    redirect('/settings');
  }

  const [categories, activeThemeId] = await Promise.all([listCategories(), getActiveThemeId()]);
  const canAdd = canAccessMenu(session, '/settings/categories', 'add');
  const canEdit = canAccessMenu(session, '/settings/categories', 'edit');

  return (
    <Stack gap="lg">
      <PageHeader
        title="دسته‌بندی کالا"
        description="تعریف گروه‌های کالا و دسته‌های زیر آن‌ها — ساختار دو سطحی."
      />
      <CategoriesManager
        initial={categories}
        sectionOptions={placementTargets(activeThemeId).map((target) => ({
          value: target.id,
          label: target.label,
        }))}
        activeThemeName={THEME_MAP[activeThemeId].name}
        activeThemeId={activeThemeId}
        canAdd={canAdd}
        canEdit={canEdit}
      />
    </Stack>
  );
}
