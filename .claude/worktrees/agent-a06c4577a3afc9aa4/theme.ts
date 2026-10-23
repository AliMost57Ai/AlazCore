'use client';

import { createTheme, type MantineColorsTuple } from '@mantine/core';

/**
 * Brand ramp — the AlazCore storefront orange (stitch_modern_store_dashboard_ui
 * / alazcore_*): 500 #ff4815 is the primary catalyst, 600 #f02d00 the pressed
 * state, with an amber accent (#ff9800) reserved for gradients. Dark surfaces
 * pick shade 4 (#ff7347) so accents stay luminous on the midnight canvas.
 */
const brand: MantineColorsTuple = [
  '#fff5f0',
  '#ffe8dc',
  '#ffd0b8',
  '#ffa885',
  '#ff7347',
  '#ff4815',
  '#f02d00',
  '#cc2100',
  '#a21d05',
  '#831c0b',
];

/**
 * Midnight Flame dark palette (midnight_flame/DESIGN.md). Mantine's dark scheme
 * maps its own steps onto these: text = dark-0, dimmed = dark-2, borders =
 * dark-4, hover = dark-5, default surfaces = dark-6, body/panels = dark-7,
 * dark-variant fills = dark-8/9. The design's tiered slate surfaces land as:
 * canvas #090D16 (set on <body> in globals.css, one step below the panels),
 * panel #0F172A, elevated control #1E293B, active overlay #283548, border
 * #334155, ink #F8FAFC / #CBD5E1 / #94A3B8.
 */
const dark: MantineColorsTuple = [
  '#F8FAFC',
  '#E2E8F0',
  '#CBD5E1',
  '#94A3B8',
  '#334155',
  '#283548',
  '#1E293B',
  '#0F172A',
  '#131C2E',
  '#182238',
];

/**
 * Persian-first stack. Vazirmatn is loaded from Google Fonts in the root
 * layout; Tahoma is the fallback that ships on Windows with usable Arabic-script
 * coverage, so the UI stays readable if the webfont fails.
 */
const fontStack =
  'Vazirmatn, IRANSansX, IRANSans, "Segoe UI", Tahoma, system-ui, -apple-system, sans-serif';

export const theme = createTheme({
  fontFamily: fontStack,
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  // The dashboard samples set page titles in font-black — Mantine caps headings
  // at one weight, so 800 keeps every page's <Title> on that voice.
  headings: { fontFamily: fontStack, fontWeight: '800' },

  primaryColor: 'brand',
  primaryShade: { light: 5, dark: 4 },
  colors: { brand, dark },

  defaultRadius: 'md',
  cursorType: 'pointer',

  // Persian text sits lower in the em box than Latin; a touch more line height
  // keeps descenders off the row below (DESIGN.md: +2–4px over Latin baselines).
  lineHeights: { xs: '1.5', sm: '1.55', md: '1.65', lg: '1.7', xl: '1.75' },

  components: {
    Card: {
      defaultProps: { withBorder: true, radius: 'lg', padding: 'lg' },
    },
    Paper: {
      defaultProps: { radius: 'lg' },
    },
    Button: {
      defaultProps: { radius: 'md' },
    },
    TextInput: {
      defaultProps: { size: 'md' },
    },
    PasswordInput: {
      defaultProps: { size: 'md' },
    },
    Modal: {
      defaultProps: { radius: 'lg', centered: true },
    },
  },
});
