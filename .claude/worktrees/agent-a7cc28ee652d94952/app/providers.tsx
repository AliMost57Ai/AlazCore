'use client';

import type { ReactNode } from 'react';
import { DirectionProvider, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { Direction } from '@/lib/constants';
import { theme } from '@/theme';

export interface ProvidersProps {
  children: ReactNode;
  /** Read from a cookie on the server, so `<html dir>` and this agree on render. */
  initialDirection: Direction;
}

export function Providers({ children, initialDirection }: ProvidersProps) {
  return (
    /*
     * detectDirection={false} is deliberate: the server already stamped the
     * right `dir` on <html> from the cookie, so letting the provider re-detect
     * on mount would only add a render where the two disagree.
     */
    <DirectionProvider initialDirection={initialDirection} detectDirection={false}>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        {/* top-center reads the same in both directions and fits narrow screens. */}
        <Notifications position="top-center" limit={3} />
        {children}
      </MantineProvider>
    </DirectionProvider>
  );
}
