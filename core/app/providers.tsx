'use client';

import type { ReactNode } from 'react';
import { DirectionProvider, MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { coreTheme } from '@/theme';

export function Providers({ children }: { children: ReactNode }) {
  return (
    // همیشه RTL — پنل Core فارسی است.
    <DirectionProvider initialDirection="rtl" detectDirection={false}>
      <MantineProvider theme={coreTheme} defaultColorScheme="light">
        <Notifications position="top-center" limit={3} />
        <ModalsProvider>{children}</ModalsProvider>
      </MantineProvider>
    </DirectionProvider>
  );
}
