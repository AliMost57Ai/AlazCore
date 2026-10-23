import type { CSSProperties, ReactNode } from 'react';
import type { ThemeConfig, ThemeDef } from '@/lib/themes';
import classes from './theme-shared.module.css';

export interface ThemeShellProps {
  theme: ThemeDef;
  config: ThemeConfig;
  children: ReactNode;
}

/**
 * Wraps a themed storefront page: sets the palette's CSS variables
 * (--theme-primary, …) plus the theme's font family, so every descendant —
 * shared or per-theme styles — picks up the admin's customization live.
 */
export default function ThemeShell({ theme, config, children }: ThemeShellProps) {
  const style = {
    '--theme-primary': config.colors.primary,
    '--theme-secondary': config.colors.secondary,
    '--theme-accent': config.colors.accent,
    '--theme-bg': config.colors.background,
    '--theme-text': config.colors.text,
    // Persian webfont — the registry's stack (Vazirmatn with Tahoma fallback)
    // covers every theme; the reference storefronts' iranyekan/iransans are
    // not on a CDN, so Vazirmatn stands in.
    fontFamily: theme.fontFamily,
    background: config.colors.background,
    color: config.colors.text,
  } as CSSProperties;

  return (
    <div className={classes.shell} style={style}>
      {children}
    </div>
  );
}
