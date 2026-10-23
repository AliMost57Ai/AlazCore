'use client';

import type { CSSProperties } from 'react';
import type { ThemePalette } from '@/lib/themes';

export interface ThemePreviewProps {
  palette: ThemePalette;
  fontFamily: string;
  /** 'card' — selector thumbnail; 'panel' — the customizer's larger preview. */
  size?: 'card' | 'panel';
  title?: string;
}

/**
 * A tiny storefront mock (header bar → hero band → product tiles → footer
 * strip) painted with a palette, so the selector cards and the customizer's
 * live preview both show what the colors actually look like together.
 * Purely decorative — the real sections live in components/themes/.
 */
export default function ThemePreview({
  palette,
  fontFamily,
  size = 'card',
  title,
}: ThemePreviewProps) {
  const panel = size === 'panel';
  const tile = panel ? 46 : 26;
  const gap = panel ? 8 : 5;

  const shell: CSSProperties = {
    fontFamily,
    background: palette.background,
    color: palette.text,
    borderRadius: panel ? 14 : 10,
    border: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
    padding: panel ? 10 : 6,
    display: 'flex',
    flexDirection: 'column',
    gap,
    direction: 'rtl',
    overflow: 'hidden',
  };
  const bar: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap,
  };
  const brand: CSSProperties = {
    width: panel ? 56 : 30,
    height: panel ? 12 : 7,
    borderRadius: 999,
    background: palette.primary,
  };
  const nav: CSSProperties = {
    display: 'flex',
    gap,
    flexGrow: 1,
    maxWidth: '55%',
  };
  const navItem: CSSProperties = {
    height: panel ? 8 : 5,
    borderRadius: 999,
    background: palette.secondary,
    opacity: 0.55,
    flexGrow: 1,
  };
  const cart: CSSProperties = {
    width: panel ? 20 : 12,
    height: panel ? 12 : 7,
    borderRadius: 4,
    background: palette.accent,
  };
  const hero: CSSProperties = {
    height: panel ? 74 : 42,
    borderRadius: panel ? 10 : 7,
    background: `linear-gradient(120deg, ${palette.primary}, ${palette.secondary})`,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: panel ? 6 : 3,
  };
  const heroTitle: CSSProperties = {
    color: '#fff',
    fontWeight: 700,
    fontSize: panel ? 14 : 9,
    lineHeight: 1.4,
    textAlign: 'center',
    padding: panel ? '0 12px' : '0 6px',
  };
  const heroCta: CSSProperties = {
    background: palette.accent,
    color: palette.text,
    fontSize: panel ? 9 : 6,
    fontWeight: 700,
    borderRadius: 999,
    padding: panel ? '3px 12px' : '2px 7px',
  };
  const row: CSSProperties = { display: 'flex', gap };
  const product: CSSProperties = {
    height: tile,
    flexGrow: 1,
    borderRadius: panel ? 8 : 5,
    border: `1px solid ${palette.primary}33`,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    gap: 3,
    padding: panel ? 5 : 3,
  };
  const price: CSSProperties = {
    height: panel ? 5 : 3,
    width: '70%',
    borderRadius: 999,
    background: palette.primary,
  };
  const line: CSSProperties = {
    height: panel ? 3 : 2,
    width: '90%',
    borderRadius: 999,
    background: palette.text,
    opacity: 0.25,
  };
  const footer: CSSProperties = {
    height: panel ? 18 : 10,
    borderRadius: panel ? 6 : 4,
    background: palette.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  };
  const footerLine: CSSProperties = {
    height: panel ? 4 : 2,
    width: panel ? 44 : 22,
    borderRadius: 999,
    background: '#fff',
    opacity: 0.6,
  };

  return (
    <div style={shell}>
      <div style={bar}>
        <span style={brand} />
        <span style={nav}>
          <span style={navItem} />
          <span style={navItem} />
          <span style={{ ...navItem, opacity: 0.3 }} />
        </span>
        <span style={cart} />
      </div>

      <div style={hero}>
        <span style={heroTitle}>{title ?? 'عنوان اسلایدر فروشگاه'}</span>
        <span style={heroCta}>مشاهده محصولات</span>
      </div>

      <div style={row}>
        {[0, 1, 2, 3].map((index) => (
          <span key={index} style={product}>
            <span style={line} />
            <span style={{ ...line, width: '50%' }} />
            <span style={price} />
          </span>
        ))}
      </div>

      <div style={footer}>
        <span style={footerLine} />
        <span style={{ ...footerLine, width: panel ? 28 : 14 }} />
      </div>
    </div>
  );
}
