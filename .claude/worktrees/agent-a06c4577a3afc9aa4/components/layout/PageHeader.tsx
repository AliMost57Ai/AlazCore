import type { ReactNode } from 'react';
import { Group, Stack, Text, Title } from '@mantine/core';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Buttons or filters aligned to the trailing edge on wide screens. */
  actions?: ReactNode;
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm" mb="lg">
      <Stack gap={4}>
        <Title order={1} fz={{ base: 'h3', sm: 'h2' }}>
          {title}
        </Title>
        {description ? (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        ) : null}
      </Stack>
      {actions}
    </Group>
  );
}
