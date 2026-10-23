/**
 * Server-side persistence for the theming engine + site identity.
 *
 * Since Batch K these live in their own Prisma models — deliberately
 * independent of AppConfig so the whole site/theme settings block can be
 * split out into a separate module later:
 *
 *   ThemeConfig table  → one row per theme (JSON config; active flag)
 *   SiteSetting table  → key/value rows for the site identity fields
 *
 * On first read after the migration, values still sitting in the old
 * `theme_*` / `site_*` AppConfig keys are copied over and the old rows are
 * deleted — a one-time, idempotent move.
 *
 * Server-only — imports lib/db. Pure types/helpers live in lib/themes.ts.
 */

import { NextResponse } from 'next/server';
import { licensedThemeKey } from './core-license';
import prisma from './db';
import {
  mergeSectionPlacement,
  sanitizeSectionIds,
  type SectionPlacements,
} from './section-placements';
import {
  DEFAULT_THEME_ID,
  HEX_PATTERN,
  parseStoredConfig,
  resolveThemeConfig,
  THEME_MAP,
  THEMES,
  type ThemeConfig,
  type ThemeId,
  type ThemePalette,
} from './themes';

const MIGRATION_KEY = 'theme_site_schema_migrated';

/**
 * Copies any legacy `theme_*` / `site_*` AppConfig rows into the dedicated
 * tables and deletes the originals. Runs at most once (guarded by a marker
 * row); after that it's a single cheap findUnique.
 */
async function migrateFromAppConfig(): Promise<void> {
  const done = await prisma.appConfig.findUnique({ where: { key: MIGRATION_KEY } });
  if (done) {
    return;
  }

  const legacy = await prisma.appConfig.findMany({
    where: {
      OR: [{ key: { startsWith: 'theme_' } }, { key: { startsWith: 'site_' } }],
    },
  });

  for (const row of legacy) {
    if (row.key === 'theme_active') {
      if (THEMES.some((theme) => theme.id === row.value)) {
        await prisma.themeConfig.updateMany({
          where: { active: true },
          data: { active: false },
        });
        await prisma.themeConfig.upsert({
          where: { themeId: row.value },
          create: { themeId: row.value, config: '{}', active: true },
          update: { active: true },
        });
      }
    } else if (row.key.startsWith('theme_config_')) {
      const themeId = row.key.slice('theme_config_'.length);
      if (THEMES.some((theme) => theme.id === themeId)) {
        await prisma.themeConfig.upsert({
          where: { themeId },
          create: { themeId, config: row.value, active: false },
          update: { config: row.value },
        });
      }
    } else {
      await prisma.siteSetting.upsert({
        where: { key: row.key },
        create: { key: row.key, value: row.value },
        update: { value: row.value },
      });
    }
  }

  await prisma.appConfig.deleteMany({
    where: {
      OR: [{ key: { startsWith: 'theme_' } }, { key: { startsWith: 'site_' } }],
    },
  });
  await prisma.appConfig.upsert({
    where: { key: MIGRATION_KEY },
    create: { key: MIGRATION_KEY, value: '1' },
    update: { value: '1' },
  });
}

// --- themes ---------------------------------------------------------------

/**
 * The active theme id — decided by Core when this shop is licensed (بند ۲-۹:
 * «مطابق با تم تعیین شده و فعال لود می‌شود»)؛ وگرنه انتخاب داخلی ادمین و در
 * نهایت تم پیش‌فرض. تمی که Core تعیین کرده ولی این نسخه فروشگاه‌ساز
 * نمی‌شناسد (custom) به انتخاب داخلی برمی‌گردد.
 */
export async function getActiveThemeId(): Promise<ThemeId> {
  await migrateFromAppConfig();

  const licensedKey = await licensedThemeKey();
  if (licensedKey && THEMES.some((theme) => theme.id === licensedKey)) {
    return licensedKey as ThemeId;
  }

  const row = await prisma.themeConfig.findFirst({ where: { active: true } });
  return row && THEMES.some((theme) => theme.id === row.themeId)
    ? (row.themeId as ThemeId)
    : DEFAULT_THEME_ID;
}

export async function setActiveTheme(id: ThemeId): Promise<void> {
  await migrateFromAppConfig();
  await prisma.$transaction(async (tx) => {
    await tx.themeConfig.updateMany({ where: { active: true }, data: { active: false } });
    await tx.themeConfig.upsert({
      where: { themeId: id },
      create: { themeId: id, config: '{}', active: true },
      update: { active: true },
    });
  });
}

/** One theme's resolved configuration (stored overrides over defaults). */
export async function getThemeConfig(id: ThemeId): Promise<ThemeConfig> {
  await migrateFromAppConfig();
  const row = await prisma.themeConfig.findUnique({ where: { themeId: id } });
  return parseStoredConfig(THEME_MAP[id], row?.config);
}

/** All four resolved configurations — the admin selector shows customized state. */
export async function getAllThemeConfigs(): Promise<Record<ThemeId, ThemeConfig>> {
  await migrateFromAppConfig();
  const rows = await prisma.themeConfig.findMany();
  const stored = new Map(rows.map((row) => [row.themeId as ThemeId, row.config]));
  return Object.fromEntries(
    THEMES.map((theme) => [theme.id, parseStoredConfig(theme, stored.get(theme.id))])
  ) as Record<ThemeId, ThemeConfig>;
}

/** The storefront's active theme with its resolved configuration. */
export async function getActiveTheme(): Promise<{ id: ThemeId; config: ThemeConfig }> {
  const id = await getActiveThemeId();
  return { id, config: await getThemeConfig(id) };
}

/**
 * Shared route-helper for theme-section placements (Batch M point 4):
 * resolves an untrusted `sectionIds` array from an admin request body into a
 * placements map for the ACTIVE theme, merged onto the item's existing pins.
 *
 *  - keyPresent = false → null (the request didn't touch placements).
 *  - invalid ids → a ready-to-return 400 NextResponse with a Persian error.
 *  - otherwise → the merged placements map to persist.
 */
export async function resolveSectionPlacements(
  sectionIds: unknown,
  existing: SectionPlacements,
  keyPresent: boolean
): Promise<SectionPlacements | NextResponse | null> {
  if (!keyPresent) {
    return null;
  }
  const themeId = await getActiveThemeId();
  const sanitized = sanitizeSectionIds(sectionIds, themeId);
  if ('error' in sanitized) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }
  return mergeSectionPlacement(existing, themeId, sanitized.sectionIds);
}

export interface SectionConfigInput {
  enabled?: unknown;
  title?: unknown;
}

/**
 * Merges validated admin input onto a theme's stored configuration and
 * persists it. Returns the resulting ThemeConfig, or a Persian error message.
 */
export async function saveThemeConfigInput(
  id: ThemeId,
  colors?: Partial<Record<keyof ThemePalette, unknown>>,
  sections?: Record<string, SectionConfigInput>
): Promise<{ config: ThemeConfig } | { error: string }> {
  const theme = THEME_MAP[id];
  await migrateFromAppConfig();
  const row = await prisma.themeConfig.findUnique({ where: { themeId: id } });
  const current = parseStoredConfig(theme, row?.config);
  const next = resolveThemeConfig(theme, current);

  if (colors) {
    for (const key of Object.keys(theme.palette) as (keyof ThemePalette)[]) {
      const value = colors[key];
      if (value === undefined) {
        continue;
      }
      if (typeof value !== 'string' || !HEX_PATTERN.test(value)) {
        return { error: 'رنگ‌ها باید به شکل کد هگز شش‌رقمی (مثل #e7a98d) باشند.' };
      }
      next.colors[key] = value.toLowerCase();
    }
  }

  if (sections) {
    for (const [key, input] of Object.entries(sections)) {
      const section = theme.sections.find((candidate) => candidate.id === key);
      if (!section) {
        return { error: `بخش «${key}» در این قالب وجود ندارد.` };
      }
      if (typeof input !== 'object' || input === null) {
        continue;
      }
      if (input.enabled !== undefined) {
        if (typeof input.enabled !== 'boolean') {
          return { error: `وضعیت نمایش بخش «${section.label}» نامعتبر است.` };
        }
        next.sections[key].enabled = input.enabled;
      }
      // Only content sections carry a heading — a title sent for the
      // header/footer (always '' in the customizer state) is ignored.
      if (section.titleable && input.title !== undefined) {
        if (typeof input.title !== 'string' || input.title.length > 80) {
          return { error: `عنوان بخش «${section.label}» نمی‌تواند بیشتر از ۸۰ نویسه باشد.` };
        }
        if (input.title.trim() === '') {
          return { error: `عنوان بخش «${section.label}» نمی‌تواند خالی باشد.` };
        }
        next.sections[key].title = input.title.trim();
      }
    }
  }

  await prisma.themeConfig.upsert({
    where: { themeId: id },
    create: { themeId: id, config: JSON.stringify(next), active: false },
    update: { config: JSON.stringify(next) },
  });

  return { config: next };
}

/** Drops a theme's stored customization (back to factory defaults). */
export async function resetThemeConfig(id: ThemeId): Promise<void> {
  await migrateFromAppConfig();
  await prisma.themeConfig.deleteMany({ where: { themeId: id } });
}

// --- site settings ---------------------------------------------------------

export interface SiteSettings {
  siteName: string;
  siteUrl: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  aboutUs: string;
  /** Upload path ('uploads/…') or '' when no enamad badge was uploaded. */
  enamadPath: string;
  /** Upload path ('uploads/…') or '' when no رسانه badge was uploaded. */
  mediaPath: string;
  /** Badge destination link (enamad profile / samandehi seal). */
  enamadUrl: string;
  mediaUrl: string;
  /** Upload path ('uploads/…') or '' when no logo has been uploaded. */
  logoPath: string;
  /** Upload path ('uploads/…') or '' when no favicon has been uploaded. */
  faviconPath: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: 'فروشگاه',
  siteUrl: '',
  contactPhone: '',
  contactEmail: '',
  contactAddress: '',
  aboutUs: '',
  enamadPath: '',
  mediaPath: '',
  enamadUrl: '',
  mediaUrl: '',
  logoPath: '',
  faviconPath: '',
};

const SITE_KEYS: Record<keyof SiteSettings, string> = {
  siteName: 'site_name',
  siteUrl: 'site_url',
  contactPhone: 'site_contact_phone',
  contactEmail: 'site_contact_email',
  contactAddress: 'site_contact_address',
  aboutUs: 'site_about_us',
  enamadPath: 'site_enamad_path',
  mediaPath: 'site_media_path',
  enamadUrl: 'site_enamad_url',
  mediaUrl: 'site_media_url',
  logoPath: 'site_logo_path',
  faviconPath: 'site_favicon_path',
};

/** All site identity fields, with defaults for anything never configured. */
export async function getSiteSettings(): Promise<SiteSettings> {
  await migrateFromAppConfig();
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: Object.values(SITE_KEYS) } },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const read = (key: keyof SiteSettings): string => values.get(SITE_KEYS[key])?.trim() ?? '';

  return {
    siteName: read('siteName') || DEFAULT_SITE_SETTINGS.siteName,
    siteUrl: read('siteUrl'),
    contactPhone: read('contactPhone'),
    contactEmail: read('contactEmail'),
    contactAddress: read('contactAddress'),
    aboutUs: read('aboutUs'),
    enamadPath: read('enamadPath'),
    mediaPath: read('mediaPath'),
    enamadUrl: read('enamadUrl'),
    mediaUrl: read('mediaUrl'),
    logoPath: read('logoPath'),
    faviconPath: read('faviconPath'),
  };
}

/** Persists the provided fields; empty values clear the stored entry. */
export async function saveSiteSettings(input: Partial<SiteSettings>): Promise<SiteSettings> {
  await migrateFromAppConfig();
  for (const [key, value] of Object.entries(input) as [keyof SiteSettings, string | undefined][]) {
    if (value === undefined) {
      continue;
    }
    const clean = value.trim();
    if (clean === '') {
      await prisma.siteSetting.deleteMany({ where: { key: SITE_KEYS[key] } });
    } else {
      await prisma.siteSetting.upsert({
        where: { key: SITE_KEYS[key] },
        create: { key: SITE_KEYS[key], value: clean },
        update: { value: clean },
      });
    }
  }
  return getSiteSettings();
}
