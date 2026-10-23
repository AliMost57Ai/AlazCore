'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconAlertCircle, IconCircleCheck, IconPalette, IconSparkles } from '@tabler/icons-react';
import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { defaultThemeConfig, type ThemeConfig, type ThemeDef, type ThemeId } from '@/lib/themes';
import ThemePreview from './ThemePreview';

export interface ThemeSelectorProps {
  themes: ThemeDef[];
  configs: Record<ThemeId, ThemeConfig>;
  activeId: ThemeId;
  /** Activate/customize only render for roles with theme:edit — the API
   *  enforces it regardless. */
  canEdit: boolean;
}

/** Whether a theme's saved config differs from its factory defaults. */
function isCustomized(theme: ThemeDef, config: ThemeConfig): boolean {
  return JSON.stringify(config) !== JSON.stringify(defaultThemeConfig(theme));
}

/**
 * The admin theme selector (تنظیمات → قالب فروشگاه): one card per theme with
 * a live mini-preview painted from the theme's current palette, an
 * "activate" action, and a shortcut into the per-theme customizer.
 */
export default function ThemeSelector({ themes, configs, activeId, canEdit }: ThemeSelectorProps) {
  const router = useRouter();
  const [pending, setPending] = useState<ThemeId | null>(null);

  async function handleSelect(id: ThemeId) {
    setPending(id);
    try {
      const response = await fetch('/api/admin/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: id }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'فعال‌سازی قالب ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }

      notifications.show({
        title: 'قالب فعال شد',
        message: 'صفحه اول فروشگاه با قالب جدید رندر می‌شود.',
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
      router.refresh();
    } catch {
      notifications.show({
        title: 'خطا',
        message: 'ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      {themes.map((theme) => {
        const config = configs[theme.id];
        const isActive = theme.id === activeId;
        const customized = isCustomized(theme, config);
        const enabledCount = theme.sections.filter(
          (section) => config.sections[section.id]?.enabled !== false
        ).length;

        return (
          <Card key={theme.id} withBorder padding="md" radius="lg">
            <Stack gap="sm" h="100%">
              <div style={{ aspectRatio: '16 / 10' }}>
                <ThemePreview palette={config.colors} fontFamily={theme.fontFamily} size="panel" />
              </div>

              <Group justify="space-between" wrap="nowrap" mt="xs">
                <Title order={4} fz="h5">
                  {theme.name}
                </Title>
                {isActive ? (
                  <Badge variant="filled" color="green" size="sm">
                    قالب فعال
                  </Badge>
                ) : customized ? (
                  <Badge
                    variant="light"
                    color="grape"
                    size="sm"
                    leftSection={<IconSparkles size={12} />}
                  >
                    شخصی‌سازی شده
                  </Badge>
                ) : null}
              </Group>

              <Text size="sm" c="dimmed" lineClamp={2}>
                {theme.tagline}
              </Text>

              <Text size="xs" c="dimmed">
                {theme.sections.length} بخش ماژولار — {enabledCount} بخش فعال
              </Text>

              <Group justify="flex-end" mt="auto">
                {canEdit ? (
                  <>
                    <Button
                      component={Link}
                      href={`/settings/theme/${theme.id}`}
                      variant={isActive ? 'filled' : 'light'}
                      leftSection={<IconPalette size={16} />}
                    >
                      شخصی‌سازی
                    </Button>
                    {!isActive ? (
                      <Button
                        variant="outline"
                        loading={pending === theme.id}
                        onClick={() => handleSelect(theme.id)}
                      >
                        انتخاب و فعال‌سازی
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </Group>
            </Stack>
          </Card>
        );
      })}
    </SimpleGrid>
  );
}
