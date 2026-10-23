'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconAlertCircle, IconCircleCheck, IconRotate, IconSection } from '@tabler/icons-react';
import {
  Button,
  Card,
  ColorInput,
  Divider,
  Grid,
  GridCol,
  Group,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  defaultThemeConfig,
  type SectionConfig,
  type ThemeConfig,
  type ThemeDef,
  type ThemePalette,
} from '@/lib/themes';
import ThemePreview from './ThemePreview';

export interface ThemeCustomizerProps {
  theme: ThemeDef;
  initial: ThemeConfig;
  /** Whether this theme is the storefront's active theme right now. */
  isActive: boolean;
}

const PALETTE_LABELS: Record<keyof ThemePalette, string> = {
  primary: 'رنگ اصلی',
  secondary: 'رنگ ثانویه',
  accent: 'رنگ تأکیدی',
  background: 'پس‌زمینه',
  text: 'رنگ متن',
};

/**
 * Per-theme customizer (تنظیمات ← قالب فروشگاه ← شخصی‌سازی): toggle each
 * modular section, retitle it, and recolor the palette — with a live mini
 * preview. "ذخیره و اعمال" persists everything through /api/admin/theme.
 */
export default function ThemeCustomizer({ theme, initial, isActive }: ThemeCustomizerProps) {
  const router = useRouter();
  const [colors, setColors] = useState<ThemePalette>(initial.colors);
  const [sections, setSections] = useState<Record<string, SectionConfig>>(initial.sections);
  const [saving, setSaving] = useState(false);

  function patchSection(id: string, patch: Partial<SectionConfig>) {
    setSections((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { themeId: theme.id, colors, sections } }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'ذخیره شخصی‌سازی ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }

      notifications.show({
        title: 'ذخیره شد',
        message: isActive
          ? 'تغییرات بلافاصله روی فروشگاه اعمال شد.'
          : 'تغییرات ذخیره شد — با فعال‌سازی این قالب دیده می‌شود.',
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
      setSaving(false);
    }
  }

  function handleReset() {
    const defaults = defaultThemeConfig(theme);
    setColors(defaults.colors);
    setSections(defaults.sections);
  }

  return (
    <Grid>
      <GridCol span={{ base: 12, lg: 7 }}>
        <Stack gap="md">
          {/* --- modular sections: toggle + editable heading ------------- */}
          <Card withBorder radius="lg">
            <Stack gap="md">
              <Group gap="xs" c="dimmed">
                <IconSection size={16} />
                <Text size="sm" fw={600}>
                  بخش‌های قالب
                </Text>
              </Group>

              {theme.sections.map((section) => (
                <Stack key={section.id} gap={4}>
                  <Switch
                    label={section.label}
                    checked={sections[section.id].enabled}
                    onChange={(event) =>
                      patchSection(section.id, { enabled: event.currentTarget.checked })
                    }
                  />
                  {section.titleable && sections[section.id].enabled ? (
                    <TextInput
                      label="عنوان بخش"
                      placeholder={section.defaultTitle}
                      value={sections[section.id].title}
                      maxLength={80}
                      onChange={(event) => patchSection(section.id, { title: event.target.value })}
                    />
                  ) : null}
                </Stack>
              ))}
            </Stack>
          </Card>

          {/* --- palette -------------------------------------------------- */}
          <Card withBorder radius="lg">
            <Stack gap="md">
              <Group gap="xs" c="dimmed">
                <IconRotate size={16} />
                <Text size="sm" fw={600}>
                  پالت رنگ
                </Text>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {(Object.keys(PALETTE_LABELS) as (keyof ThemePalette)[]).map((key) => (
                  <ColorInput
                    key={key}
                    label={PALETTE_LABELS[key]}
                    format="hex"
                    swatches={[theme.palette[key], colors[key], '#ffffff', '#000000']}
                    value={colors[key]}
                    onChange={(value) => setColors((current) => ({ ...current, [key]: value }))}
                  />
                ))}
              </SimpleGrid>
            </Stack>
          </Card>
        </Stack>
      </GridCol>

      <GridCol span={{ base: 12, lg: 5 }}>
        <Card
          withBorder
          radius="lg"
          pos="sticky"
          top="calc(var(--app-shell-header-height, 60px) + 16px)"
        >
          <Stack gap="md">
            <Title order={4} fz="h5">
              پیش‌نمایش زنده
            </Title>
            <Text size="xs" c="dimmed">
              {isActive
                ? 'این قالب همین حالا روی فروشگاه فعال است.'
                : 'پیش‌نمایش — این قالب فعال نیست؛ تغییرات با «انتخاب و فعال‌سازی» در فهرست قالب‌ها اعمال می‌شود.'}
            </Text>

            <ThemePreview palette={colors} fontFamily={theme.fontFamily} size="panel" />

            <Divider />

            <Group justify="flex-end">
              <Button variant="subtle" onClick={handleReset}>
                بازنشانی به پیش‌فرض
              </Button>
              <Button loading={saving} onClick={handleSave}>
                ذخیره و اعمال
              </Button>
            </Group>

            <Divider labelPosition="center" label="بخش‌های فعال" />
            <Text size="sm" c="dimmed">
              {theme.sections
                .filter((section) => sections[section.id].enabled)
                .map((section) => section.label)
                .join(' · ') || 'همه بخش‌ها خاموش هستند.'}
            </Text>

            <Button component={Link} href="/settings/theme" variant="light" size="xs" fullWidth>
              بازگشت به فهرست قالب‌ها
            </Button>
          </Stack>
        </Card>
      </GridCol>
    </Grid>
  );
}
