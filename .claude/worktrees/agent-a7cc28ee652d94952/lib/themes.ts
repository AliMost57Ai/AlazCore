/**
 * Theme registry for the storefront theming engine.
 *
 * Pure data + helpers — safe to import from client components (the admin
 * selector/customizer) as well as server code. Persistence lives in
 * lib/theme-settings.ts; rendering in components/themes/.
 *
 * Every theme is defined by:
 *  - an identity (id, Persian name, tagline, Persian webfont),
 *  - a default color palette (5 CSS-variable slots, sampled from the real
 *    reference storefront each theme is modeled on),
 *  - a list of modular sections that the admin can toggle on/off and
 *    (when they display a heading) retitle from the customizer.
 */

export type ThemeId = 'beautyshop' | 'digimarket' | 'digishop' | 'softkala';

/** The 5 palette slots exposed to the admin customizer. */
export interface ThemePalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface SectionDef {
  /** Stable key — also the DOM anchor id on the storefront. */
  id: string;
  /** Admin-facing Persian label in the customizer. */
  label: string;
  /** Default storefront heading. */
  defaultTitle: string;
  /** Header/footer carry no display heading — toggle only. */
  titleable: boolean;
}

export interface ThemeDef {
  id: ThemeId;
  /** Persian display name. */
  name: string;
  /** One-line description for the selector card. */
  tagline: string;
  /** Font stack — a Persian webfont family (Vazirmatn fallback). */
  fontFamily: string;
  palette: ThemePalette;
  sections: SectionDef[];
}

/** Per-section customization: visibility + heading text. */
export interface SectionConfig {
  enabled: boolean;
  title: string;
}

/** A theme's full saved customization (palette overrides + section state). */
export interface ThemeConfig {
  colors: ThemePalette;
  sections: Record<string, SectionConfig>;
}

/** A theme definition merged with its resolved configuration. */
export interface ResolvedTheme extends ThemeDef {
  config: ThemeConfig;
}

export const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const THEMES: ThemeDef[] = [
  {
    id: 'beautyshop',
    name: 'BeautyShop — آرایشی بهداشتی',
    tagline: 'نرم و لطیف؛ اسلایدر بزرگ، مجله و خبرنامه — مناسب فروشگاه‌های آرایشی و بهداشتی.',
    fontFamily: "'YekanBakh', 'Vazirmatn', Tahoma, sans-serif",
    palette: {
      // Real Woodmart skin: primary rgb(231,169,141), titles rgb(76,76,76).
      primary: '#e7a98d',
      secondary: '#f5d7c8',
      accent: '#c98d6b',
      background: '#f9f9f9',
      text: '#4c4c4c',
    },
    sections: [
      { id: 'header', label: 'هدر', defaultTitle: '', titleable: false },
      {
        id: 'heroSlider',
        label: 'اسلایدر اصلی',
        defaultTitle: 'درخشش طبیعی پوست شما',
        titleable: true,
      },
      {
        id: 'bestSellers',
        label: 'پرفروش‌ترین‌ها',
        defaultTitle: 'پر فروش ترین محصولات',
        titleable: true,
      },
      {
        id: 'latestPosts',
        label: 'مجله فروشگاه',
        defaultTitle: 'مجله آرایشی بیوتی شاپ',
        titleable: true,
      },
      {
        id: 'newsletter',
        label: 'خبرنامه',
        defaultTitle: 'از تخفیف‌ها جا نمانید',
        titleable: true,
      },
      { id: 'footer', label: 'فوتر', defaultTitle: '', titleable: false },
    ],
  },
  {
    id: 'digimarket',
    name: 'DigiMarket — لوازم جانبی موبایل',
    tagline: 'تیره و تکنیکال؛ پیشنهاد شگفت‌انگیز، دسته‌بندی و کاروسل برندها — گوشی و گجت.',
    fontFamily: "'YekanBakh', 'Vazirmatn', Tahoma, sans-serif",
    palette: {
      // Real skin: accent #d60644 (hover #b5003c), dark header #32373c, black footer.
      primary: '#d60644',
      secondary: '#32373c',
      accent: '#b5003c',
      background: '#ffffff',
      text: '#32373c',
    },
    sections: [
      { id: 'header', label: 'هدر', defaultTitle: '', titleable: false },
      {
        id: 'smartDeal',
        label: 'پیشنهاد شگفت‌انگیز',
        defaultTitle: 'شگفتــ انگیــزهای هوشــمند',
        titleable: true,
      },
      {
        id: 'categoryGrid',
        label: 'دسته‌بندی‌ها',
        defaultTitle: 'خرید بر اساس دسته‌بندی',
        titleable: true,
      },
      {
        id: 'productGrid',
        label: 'محصولات',
        defaultTitle: 'محصولاتـــ دیجی مارکت',
        titleable: true,
      },
      {
        id: 'brandCarousel',
        label: 'برندها',
        defaultTitle: 'برندهای محبوب',
        titleable: true,
      },
      { id: 'footer', label: 'فوتر', defaultTitle: '', titleable: false },
    ],
  },
  {
    id: 'digishop',
    name: 'DigiShop — دیجی‌شاپ',
    tagline: 'قرمز پرانرژی و سفید تمیز؛ شگفت‌انگیز، راهنمای هدیه و ویترین — فروشگاه کالا و زیبایی.',
    // The site-standard Persian stack (Vazirmatn, loaded in app/layout) — the
    // DigiShop design mocks use Plus Jakarta Sans, which has no Persian glyphs;
    // keeping the house font is both the standard and the only thing that
    // actually renders Farsi.
    fontFamily: "'Vazirmatn', 'IRANSansX', 'Segoe UI', Tahoma, sans-serif",
    palette: {
      // DigiShop design tokens: brand red #EF394E (hover #D31535), green tag
      // #059669, amber accent #F59E0B, page bg #F8F9FB, text #1F2937.
      primary: '#ef394e',
      secondary: '#059669',
      accent: '#f59e0b',
      background: '#f8f9fb',
      text: '#1f2937',
    },
    sections: [
      { id: 'header', label: 'هدر', defaultTitle: '', titleable: false },
      {
        id: 'amazingDeals',
        label: 'پیشنهاد شگفت‌انگیز',
        defaultTitle: 'پیشنهاد شگفت‌انگیز',
        titleable: true,
      },
      {
        id: 'giftIdeas',
        label: 'هدیه چی بدم؟!',
        defaultTitle: 'هدیه چی بدم؟!',
        titleable: true,
      },
      {
        id: 'productDisplay',
        label: 'ویترین محصولات',
        defaultTitle: 'پیشنهادات فروشگاه',
        titleable: true,
      },
      { id: 'footer', label: 'فوتر', defaultTitle: '', titleable: false },
    ],
  },
  {
    id: 'softkala',
    name: 'SoftKala — سخت‌افزار',
    tagline: 'تمیز و اطلاعاتی؛ دسته‌بندی منتخب و گرید فشرده — قطعات و سخت‌افزار.',
    fontFamily: "'YekanBakh', 'Vazirmatn', Tahoma, sans-serif",
    palette: {
      // Real skin: primary rgb(67,95,203), tints #c6ceef/#ebeffa, text #242424.
      primary: '#435fcb',
      secondary: '#7b85a3',
      accent: '#c6ceef',
      background: '#ffffff',
      text: '#242424',
    },
    sections: [
      { id: 'header', label: 'هدر', defaultTitle: '', titleable: false },
      {
        id: 'categoryFeature',
        label: 'دسته‌بندی منتخب',
        defaultTitle: 'برترین کیس ها',
        titleable: true,
      },
      {
        id: 'productGrid',
        label: 'محصولات',
        defaultTitle: 'منتخب کارت گرافیک',
        titleable: true,
      },
      { id: 'footer', label: 'فوتر', defaultTitle: '', titleable: false },
    ],
  },
];

export const THEME_MAP: Record<ThemeId, ThemeDef> = THEMES.reduce(
  (map, theme) => ({ ...map, [theme.id]: theme }),
  {} as Record<ThemeId, ThemeDef>
);

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some((theme) => theme.id === value);
}

/** The theme used when nothing has been selected yet. */
export const DEFAULT_THEME_ID: ThemeId = 'beautyshop';

/** A theme's factory-default configuration (all sections at their defaults). */
export function defaultThemeConfig(theme: ThemeDef): ThemeConfig {
  return {
    colors: { ...theme.palette },
    sections: Object.fromEntries(
      theme.sections.map((section) => [section.id, { enabled: true, title: section.defaultTitle }])
    ),
  };
}

/**
 * Merges a (possibly partial / hostile) stored value onto a theme's defaults.
 * Unknown section keys are dropped, bad hex colors fall back to the default,
 * and every declared section always resolves — the storefront can trust the
 * result without further checks.
 */
export function resolveThemeConfig(theme: ThemeDef, stored: unknown): ThemeConfig {
  const base = defaultThemeConfig(theme);
  if (typeof stored !== 'object' || stored === null) {
    return base;
  }

  const raw = stored as {
    colors?: Record<string, unknown>;
    sections?: Record<string, { enabled?: unknown; title?: unknown }>;
  };

  const colors = { ...base.colors };
  for (const key of Object.keys(colors) as (keyof ThemePalette)[]) {
    const value = raw.colors?.[key];
    if (typeof value === 'string' && HEX_PATTERN.test(value)) {
      colors[key] = value.toLowerCase();
    }
  }

  const sections = { ...base.sections };
  if (typeof raw.sections === 'object' && raw.sections !== null) {
    for (const section of theme.sections) {
      const override = raw.sections[section.id];
      if (typeof override !== 'object' || override === null) {
        continue;
      }
      sections[section.id] = {
        enabled: typeof override.enabled === 'boolean' ? override.enabled : true,
        title:
          typeof override.title === 'string' && override.title.trim() !== ''
            ? override.title.trim().slice(0, 80)
            : base.sections[section.id].title,
      };
    }
  }

  return { colors, sections };
}

/** Parses a stored JSON config string; anything malformed falls back to defaults. */
export function parseStoredConfig(theme: ThemeDef, json: string | undefined): ThemeConfig {
  if (!json) {
    return defaultThemeConfig(theme);
  }
  try {
    return resolveThemeConfig(theme, JSON.parse(json));
  } catch {
    return defaultThemeConfig(theme);
  }
}
