import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ThemeCustomizer from '@/components/settings/ThemeCustomizer';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { getActiveThemeId, getThemeConfig } from '@/lib/theme-settings';
import { isThemeId, THEME_MAP } from '@/lib/themes';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const theme = isThemeId(id) ? THEME_MAP[id] : null;
  return { title: `تنظیمات — ${theme ? theme.name.split(' — ')[0] : 'قالب'}` };
}

export const dynamic = 'force-dynamic';

/** Admin-only: customize one theme's sections, titles, and palette. */
export default async function ThemeCustomizerPage({ params }: PageProps) {
  const session = await requireSession('/settings/theme');

  if (!canAccessMenu(session, '/settings/theme')) {
    redirect('/settings');
  }
  // The customizer only writes — reaching it without the edit grant is a dead
  // end; the theme cards hide the link, this covers direct URLs.
  if (!canAccessMenu(session, '/settings/theme', 'edit')) {
    redirect('/settings/theme');
  }

  const { id } = await params;
  if (!isThemeId(id)) {
    notFound();
  }

  const theme = THEME_MAP[id];
  const [config, activeId] = await Promise.all([getThemeConfig(id), getActiveThemeId()]);

  return (
    <Stack gap="lg">
      <PageHeader
        title={`شخصی‌سازی ${theme.name}`}
        description="بخش‌ها را روشن/خاموش کنید، عنوان هر بخش را ویرایش کنید و پالت رنگ را تغییر دهید."
      />
      <ThemeCustomizer theme={theme} initial={config} isActive={activeId === id} />
    </Stack>
  );
}
