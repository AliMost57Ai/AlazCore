'use client';

import { Button, Center, Stack, Text, Title } from '@mantine/core';

export default function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Center mih="50vh">
      <Stack gap="sm" align="center">
        <Title order={3}>این بخش بارگذاری نشد</Title>
        <Text size="sm" c="dimmed">
          خطای موقتی — دوباره تلاش کنید. {error.digest ? `(کد: ${error.digest})` : ''}
        </Text>
        <Button onClick={reset} variant="light">
          تلاش مجدد
        </Button>
      </Stack>
    </Center>
  );
}
