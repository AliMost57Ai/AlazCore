'use client';

import { Group, Stack, Text, Title } from '@mantine/core';

/**
 * سربرگ استاندارد صفحات پنل Core — تایپوگرافی تم (وزن ۸۰۰)، توضیح کم‌رنگ، و
 * جایگاه ثابت اکشن‌های صفحه. Spacing پایه ۸ و بدون سایه (عمق از بوردر/سطح).
 */
export default function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
      <Stack gap={4} style={{ minWidth: 0 }}>
        <Title order={2} lh={1.2}>
          {title}
        </Title>
        {description ? (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        ) : null}
      </Stack>
      {actions ? <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>{actions}</Group> : null}
    </Group>
  );
}
