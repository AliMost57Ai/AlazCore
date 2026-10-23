import { NextResponse, type NextRequest } from 'next/server';
import { requireApiMenu } from '@/lib/api-auth';
import {
  getActiveThemeId,
  getAllThemeConfigs,
  saveThemeConfigInput,
  setActiveTheme,
  type SectionConfigInput,
} from '@/lib/theme-settings';
import { isThemeId, type ThemePalette } from '@/lib/themes';

interface ThemeConfigBody {
  themeId?: unknown;
  colors?: Record<string, unknown>;
  sections?: Record<string, SectionConfigInput>;
}

interface ThemeBody {
  active?: unknown;
  config?: ThemeConfigBody;
}

/** Active theme + every theme's configuration — admin only. */
export async function GET() {
  const session = await requireApiMenu('/settings/theme');
  if (session instanceof NextResponse) {
    return session;
  }

  const [active, configs] = await Promise.all([getActiveThemeId(), getAllThemeConfigs()]);
  return NextResponse.json({ active, configs });
}

/**
 * Persists theming changes — needs the theme:edit grant. The body may carry
 * either or both:
 *  - `active`: select the storefront's active theme,
 *  - `config`: palette/section customization for a single theme
 *    ({ themeId, colors?, sections? }).
 */
export async function PUT(request: NextRequest) {
  const session = await requireApiMenu('/settings/theme', 'edit');
  if (session instanceof NextResponse) {
    return session;
  }

  let body: ThemeBody;
  try {
    body = (await request.json()) as ThemeBody;
  } catch {
    return NextResponse.json({ error: 'درخواست نامعتبر است.' }, { status: 400 });
  }

  if (body.active !== undefined) {
    if (!isThemeId(body.active)) {
      return NextResponse.json({ error: 'قالب انتخابی وجود ندارد.' }, { status: 400 });
    }
    await setActiveTheme(body.active);
  }

  if (body.config !== undefined) {
    const { themeId, colors, sections } = body.config;
    if (!isThemeId(themeId)) {
      return NextResponse.json({ error: 'قالب انتخابی وجود ندارد.' }, { status: 404 });
    }

    // Only known palette slots / section ids are forwarded — anything else
    // makes the request invalid (saveThemeConfigInput returns the Persian
    // error rather than silently ignoring unknown keys).
    let palette: Partial<Record<keyof ThemePalette, unknown>> | undefined;
    if (colors !== undefined) {
      if (typeof colors !== 'object' || colors === null) {
        return NextResponse.json({ error: 'پالت رنگ نامعتبر است.' }, { status: 400 });
      }
      palette = colors as Partial<Record<keyof ThemePalette, unknown>>;
    }

    let sectionInput: Record<string, SectionConfigInput> | undefined;
    if (sections !== undefined) {
      if (typeof sections !== 'object' || sections === null) {
        return NextResponse.json({ error: 'فهرست بخش‌ها نامعتبر است.' }, { status: 400 });
      }
      sectionInput = sections;
    }

    const result = await saveThemeConfigInput(themeId, palette, sectionInput);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const [active, configs] = await Promise.all([getActiveThemeId(), getAllThemeConfigs()]);
    return NextResponse.json({ ok: true, active, configs });
  }

  if (body.active === undefined) {
    return NextResponse.json({ error: 'تغییری برای ذخیره ارسال نشده است.' }, { status: 400 });
  }

  const [active, configs] = await Promise.all([getActiveThemeId(), getAllThemeConfigs()]);
  return NextResponse.json({ ok: true, active, configs });
}
