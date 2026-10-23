'use client';

import { createTheme, type MantineColorsTuple } from '@mantine/core';

/**
 * پالت برند AlazCore — استخراج‌شده از لوگوهای رسمی (d:\Pictures\AlazCore):
 *  - canvas سرمه‌ای دودی #1B2A34 (زمینه تیره لوگوی کامل)
 *  - شعله نارنجی #FB7401 (گرادیان اصلی لوگو — primary)
 *  - زرشکی عمیق #7C000C (سایه قرمز لوگو — accent/danger)
 * ش‌های روشن برند برای حالت light ساخته شده‌اند؛ در dark شماره 4 درخشان می‌ماند.
 */
const brand: MantineColorsTuple = [
  '#fff4ec',
  '#ffe3d1',
  '#ffc3a1',
  '#ff9d66',
  '#fb8438',
  '#fb7401',
  '#e56400',
  '#c25100',
  '#9e4100',
  '#7a3300',
];

/** Midnight Steel — سرمه‌ای دودی لوگو به‌جای آبی‌خاکستری عمومی. */
const dark: MantineColorsTuple = [
  '#F4F7F8',
  '#DDE6E9',
  '#C2CFD4',
  '#9DB1B8',
  '#3E525B',
  '#2B3F48',
  '#22333B',
  '#1B2A34',
  '#141F26',
  '#101a20',
];

/** زرشکی لوگو برای Badge/حالت‌های خطا — با red جایگزین نشد چون هویت برند است. */
const crimson: MantineColorsTuple = [
  '#fdeef0',
  '#fbdce0',
  '#f5b3bb',
  '#ee8390',
  '#e75c6d',
  '#7C000C',
  '#8f1f2a',
  '#77151f',
  '#5e0e17',
  '#43080e',
];

const fontStack =
  'Vazirmatn, IRANSansX, IRANSans, "Segoe UI", Tahoma, system-ui, -apple-system, sans-serif';

export const coreTheme = createTheme({
  fontFamily: fontStack,
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  headings: { fontFamily: fontStack, fontWeight: '800' },

  primaryColor: 'brand',
  primaryShade: { light: 5, dark: 4 },
  colors: { brand, dark, crimson },

  defaultRadius: 'md',
  cursorType: 'pointer',
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
    Select: {
      defaultProps: { size: 'md' },
    },
    Modal: {
      defaultProps: { radius: 'lg', centered: true },
    },
  },
});
