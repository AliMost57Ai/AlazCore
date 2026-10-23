import { Anchor, Badge, Card, Divider, Group, Stack, Text, Title } from '@mantine/core';
import type { CustomerContextDTO } from '@/lib/customer-tickets';
import { enCurrency, enNumber } from '@/lib/format';
import { STATUS_COLORS, STATUS_LABELS, type OrderStatus } from '@/lib/order-status';

export interface CustomerContextPanelProps {
  /** برای تیکت مهمان null — حسابی برای دیدن نیست. */
  context: CustomerContextDTO | null;
  /** هویت مهمان — وقتی پنل حسابی وجود ندارد به‌جای آن نمایش داده می‌شود. */
  guest: { name: string; phone: string | null } | null;
  /** آیا این نشست گرهٔ باز کردن پرونده را دارد ('/customers' یا توکن مستقل
   *  '/customers/file') — پشتیبانیِ بدون هیچ‌کدام نباید لینکی ببیند که به
   *  داشبورد برمی‌گرداندش. */
  canViewFile: boolean;
}

/**
 * Context فقط-خواندنی پشتیبان کنار رشته گفتگو: که مشتری کیست، آخرین سفارشش و
 * وضعیت کیف پولش — پورت نسخه مرجع.
 *
 * فقط-خواندنی به‌صورت عمدی — پاسخ‌دادن به تیکت هرگز پول جابه‌جا نمی‌کند و به
 * سفارش دست نمی‌زند. هر کاری که نوشتن می‌خواهد در صفحات سفارش‌ها/کیف پول می‌ماند
 * که مجوزهای خودشان را دارند.
 */
export default function CustomerContextPanel({
  context,
  guest,
  canViewFile,
}: CustomerContextPanelProps) {
  if (!context) {
    return (
      <Card withBorder padding="md">
        <Title order={2} fz="h6" mb="xs">
          درخواست‌کننده
        </Title>
        <Stack gap={4}>
          <Group gap="xs">
            <Text size="sm" fw={600}>
              {guest?.name ?? 'کاربر مهمان'}
            </Text>
            <Badge size="xs" variant="light" color="grape">
              مهمان
            </Badge>
          </Group>
          {guest?.phone ? (
            <Text size="sm" c="dimmed" dir="ltr">
              {guest.phone}
            </Text>
          ) : null}
          <Text size="xs" c="dimmed" mt="xs">
            این کاربر مهمان است و حساب کاربری ندارد؛ بنابراین سفارش و کیف پولی برای نمایش وجود
            ندارد. برای پیگیری، از همین گفتگو یا شمارهٔ بالا استفاده کنید.
          </Text>
        </Stack>
      </Card>
    );
  }

  const order = context.lastOrder;

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        <Title order={2} fz="h6" mb="xs">
          مشتری
        </Title>
        <Stack gap={2}>
          <Text size="sm" fw={600}>
            {context.name}
          </Text>
          {context.phone ? (
            <Text size="sm" c="dimmed" dir="ltr">
              {context.phone}
            </Text>
          ) : null}
          {context.email ? (
            <Text size="xs" c="dimmed" dir="ltr">
              {context.email}
            </Text>
          ) : null}
          <Group gap="xs" mt={6}>
            <Badge size="xs" variant="light">
              {enNumber(context.orderCount)} سفارش
            </Badge>
            <Badge
              size="xs"
              variant="light"
              color={context.openTicketCount > 0 ? 'orange' : 'gray'}
            >
              {enNumber(context.openTicketCount)} تیکت باز
            </Badge>
          </Group>
          {canViewFile ? (
            <Anchor href={`/customers/${context.userId}`} size="xs" c="brand" mt={6}>
              مشاهدهٔ پروندهٔ مشتری
            </Anchor>
          ) : (
            <Text size="xs" c="dimmed" mt={6}>
              برای دیدن پروندهٔ کامل مشتری، دسترسی «مشاهدهٔ پروندهٔ مشتری» لازم است.
            </Text>
          )}
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Title order={2} fz="h6" mb="xs">
          آخرین سفارش
        </Title>
        {order ? (
          <Stack gap={4}>
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm" ff="monospace">
                {order.displayId}
              </Text>
              <Badge
                size="sm"
                variant="light"
                color={STATUS_COLORS[order.status as OrderStatus] ?? 'gray'}
              >
                {STATUS_LABELS[order.status as OrderStatus] ?? order.status}
              </Badge>
            </Group>
            <Text size="sm" fw={700}>
              {enCurrency(order.amount, false)}
            </Text>
            <Text size="xs" c="dimmed">
              {order.date}
            </Text>
            {order.trackingCode ? (
              <Text size="xs" c="dimmed" dir="ltr">
                {order.trackingCode}
              </Text>
            ) : null}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            این مشتری هنوز سفارشی ثبت نکرده است.
          </Text>
        )}
      </Card>

      <Card withBorder padding="md">
        <Title order={2} fz="h6" mb="xs">
          وضعیت کیف پول
        </Title>
        <Group justify="space-between" mb="xs">
          <Text size="sm" c="dimmed">
            موجودی
          </Text>
          <Text size="sm" fw={700} c={context.walletBalance > 0 ? 'teal' : undefined}>
            {enCurrency(context.walletBalance, false)}
          </Text>
        </Group>
        {context.walletLines.length === 0 ? (
          <Text size="xs" c="dimmed">
            تراکنشی در کیف پول این مشتری ثبت نشده است.
          </Text>
        ) : (
          <>
            <Divider mb="xs" />
            <Stack gap="xs">
              {context.walletLines.map((line) => (
                <Group key={line.id} justify="space-between" gap="xs" wrap="nowrap">
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {line.label}
                  </Text>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="xs" c="dimmed">
                      {line.date}
                    </Text>
                    <Text size="xs" fw={700} c={line.amount >= 0 ? 'teal' : undefined}>
                      {line.amount >= 0 ? '+' : '−'}
                      {enCurrency(Math.abs(line.amount), false)}
                    </Text>
                  </Group>
                </Group>
              ))}
            </Stack>
          </>
        )}
        <Text size="xs" c="dimmed" mt="sm">
          این پنل فقط خواندنی است؛ برای تغییر موجودی از صفحهٔ مشتریان استفاده کنید.
        </Text>
      </Card>
    </Stack>
  );
}
