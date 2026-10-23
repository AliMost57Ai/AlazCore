import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Stack } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ThemeSelector from '@/components/settings/ThemeSelector';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { getActiveThemeId, getAllThemeConfigs } from '@/lib/theme-settings';
import { THEMES } from '@/lib/themes';

export const metadata: Metadata = {
  title: 'تنظیمات — قالب فروشگاه',
};

export const dynamic = 'force-dynamic';

/** Admin-only: pick which of the four storefront themes is live. */
export default async function ThemeSettingsPage() {
  const session = await requireSession('/settings/theme');

  if (!canAccessMenu(session, '/settings/theme')) {
    redirect('/settings');
  }

  const [activeId, configs] = await Promise.all([getActiveThemeId(), getAllThemeConfigs()]);
  const canEdit = canAccessMenu(session, '/settings/theme', 'edit');

  return (
    <Stack gap="lg">
      <PageHeader
        title="قالب فروشگاه"
        description="قالب فعالِ صفحه اول فروشگاه را انتخاب کنید یا هر قالب را شخصی‌سازی کنید (تنظیمات ← قالب فروشگاه)."
      />
      <ThemeSelector themes={THEMES} configs={configs} activeId={activeId} canEdit={canEdit} />
    </Stack>
  );
}
