'use client';

import { IconMoon, IconSun, IconTextDirectionLtr, IconTextDirectionRtl } from '@tabler/icons-react';
import {
  ActionIcon,
  Tooltip,
  useComputedColorScheme,
  useDirection,
  useMantineColorScheme,
} from '@mantine/core';
import { DIRECTION_COOKIE, SESSION_MAX_AGE, type Direction } from '@/lib/constants';

/**
 * Persists the chosen direction so the server can set `<html dir>` on the next
 * request — without it, every reload would flash back to the default.
 * Not httpOnly on purpose: it is a display preference the client must write.
 */
function persistDirection(dir: Direction) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${DIRECTION_COOKIE}=${dir}; Path=/; Max-Age=${SESSION_MAX_AGE}; SameSite=Lax${secure}`;
}

export default function DirectionControl() {
  const { dir, setDirection } = useDirection();
  const next = dir === 'rtl' ? 'ltr' : 'rtl';

  return (
    <Tooltip label={next === 'rtl' ? 'چیدمان راست‌به‌چپ' : 'چیدمان چپ‌به‌راست'}>
      <ActionIcon
        variant="default"
        size="lg"
        radius="md"
        aria-label={next === 'rtl' ? 'تغییر به چیدمان راست‌به‌چپ' : 'تغییر به چیدمان چپ‌به‌راست'}
        onClick={() => {
          setDirection(next);
          persistDirection(next);
        }}
      >
        {dir === 'rtl' ? <IconTextDirectionLtr size={19} /> : <IconTextDirectionRtl size={19} />}
      </ActionIcon>
    </Tooltip>
  );
}

export function ColorSchemeControl() {
  const { setColorScheme } = useMantineColorScheme();
  // getInitialValueInEffect avoids a hydration mismatch when the OS prefers dark.
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const next = computed === 'dark' ? 'light' : 'dark';

  return (
    <Tooltip label={next === 'dark' ? 'حالت تاریک' : 'حالت روشن'}>
      <ActionIcon
        variant="default"
        size="lg"
        radius="md"
        aria-label={next === 'dark' ? 'تغییر به حالت تاریک' : 'تغییر به حالت روشن'}
        onClick={() => setColorScheme(next)}
      >
        {computed === 'dark' ? <IconSun size={19} /> : <IconMoon size={19} />}
      </ActionIcon>
    </Tooltip>
  );
}
