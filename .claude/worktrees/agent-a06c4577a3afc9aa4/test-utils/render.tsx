import { render as testingLibraryRender } from '@testing-library/react';
import { DirectionProvider, MantineProvider } from '@mantine/core';
import { theme } from '../theme';

export function render(ui: React.ReactNode) {
  return testingLibraryRender(<>{ui}</>, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <DirectionProvider initialDirection="rtl" detectDirection={false}>
        <MantineProvider theme={theme} env="test" defaultColorScheme="light">
          {children}
        </MantineProvider>
      </DirectionProvider>
    ),
  });
}
