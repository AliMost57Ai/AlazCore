import { Anchor, Center, Stack, Text, Title } from '@mantine/core';

/**
 * مرز not-found گروه پنل — تا notFound() صفحات داخلی به صفحه پیش‌فرض انگلیسی
 * Next نیفتد؛ داخل شل داشبورد رندر می‌شود.
 */
export default function PanelNotFound() {
  return (
    <Center mih="50vh">
      <Stack gap="xs" align="center">
        <Title order={3}>این صفحه پیدا نشد</Title>
        <Text size="sm" c="dimmed">
          نشانی درخواستی وجود ندارد یا حذف شده است.
        </Text>
        <Anchor href="/dashboard" size="sm" c="brand">
          بازگشت به داشبورد
        </Anchor>
      </Stack>
    </Center>
  );
}
