'use client';

import { Divider, Group, Stack, Table, Text } from '@mantine/core';
import RemoveOrderItemButton from '@/components/orders/RemoveOrderItemButton';
import { enCurrency, enNumber } from '@/lib/format';

export interface PanelOrderItemLine {
  name: string;
  qty: number;
  unitPrice: number;
  /** شناسه کالا/واریانت — پیش‌نیاز عملیات قلمی (حذف از سفارش). */
  productId?: string;
  variantId?: string | null;
}

export interface OrderItemsDetailProps {
  items: PanelOrderItemLine[];
  /**
   * حذف قلم توسط مالک — فقط برای سفارش پرداخت‌شده پیش از ارسال و با مجوز
   * edit سفارش‌ها؛ توضیح اجباری مودال روی سفارش می‌نشیند و مشتری می‌بیند.
   */
  remove?: { orderDisplayId: string; status: 'paid' | 'boxing' };
}

/**
 * جدول واحد اقلام سفارش — تک منبع نمایش جزئیات کالا/مبلغ در همه لیست‌های پنل
 * (سفارش‌ها، تحویل حضوری، حسابداری) و صفحه اختصاصی جزئیات.
 *
 * دسکتاپ (sm+): جدول با فاصله و فونت sm (قاعده خوانایی جدول مبلغ‌ها —
 * verticalSpacing={4} + fz="xs" ممنوع) و ارقام جدولی. موبایل: ردیف‌های
 * تک‌ستونه با جداکننده نقطه‌چین — هیچ جدول عریضی در ۳۶۰px نمی‌نشیند.
 */
export default function OrderItemsDetail({ items, remove }: OrderItemsDetailProps) {
  const canRemove = (line: PanelOrderItemLine): boolean =>
    Boolean(remove && line.productId && items.length > 1);

  const lineAction = (line: PanelOrderItemLine) =>
    canRemove(line) && line.productId ? (
      <RemoveOrderItemButton
        orderDisplayId={remove!.orderDisplayId}
        productId={line.productId}
        variantId={line.variantId ?? null}
        lineName={line.name}
      />
    ) : null;

  if (items.length === 0) {
    return (
      <Text size="sm" c="dimmed" py={4}>
        برای این سفارش اقلامی ثبت نشده است.
      </Text>
    );
  }

  const total = items.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);

  return (
    <>
      {/* دسکتاپ: جدول کامل کالا/تعداد/قیمت واحد/جمع خط. */}
      <Stack gap="sm" visibleFrom="sm">
        <Table verticalSpacing="sm" horizontalSpacing="md" fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>کالا</Table.Th>
              <Table.Th w={90} style={{ textAlign: 'center' }}>
                تعداد
              </Table.Th>
              <Table.Th w={150} style={{ textAlign: 'end' }}>
                قیمت واحد
              </Table.Th>
              <Table.Th w={150} style={{ textAlign: 'end' }}>
                جمع خط
              </Table.Th>
              {remove ? <Table.Th w={130} /> : null}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((line, index) => (
              <Table.Tr key={`${line.name}-${index}`}>
                <Table.Td>{line.name}</Table.Td>
                <Table.Td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                  {enNumber(line.qty)}
                </Table.Td>
                <Table.Td style={{ textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>
                  {enCurrency(line.unitPrice, false)}
                </Table.Td>
                <Table.Td style={{ textAlign: 'end', fontVariantNumeric: 'tabular-nums' }} fw={600}>
                  {enCurrency(line.qty * line.unitPrice, false)}
                </Table.Td>
                {remove ? (
                  <Table.Td style={{ textAlign: 'end' }}>{lineAction(line)}</Table.Td>
                ) : null}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Group justify="flex-end">
          <Text size="sm" fw={700}>
            جمع اقلام: {enCurrency(total, false)}
          </Text>
        </Group>
      </Stack>

      {/* موبایل: هر قلم یک ردیف دوخطی — نام + جمع، زیرش تعداد × قیمت واحد. */}
      <Stack gap="sm" hiddenFrom="sm">
        {items.map((line, index) => (
          <Stack key={`${line.name}-${index}`} gap={2}>
            <Group justify="space-between" wrap="nowrap" gap="xs">
              <Text size="sm" fw={500} style={{ flex: 1 }}>
                {line.name}
              </Text>
              <Text size="sm" fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {enCurrency(line.qty * line.unitPrice, false)}
              </Text>
            </Group>
            <Group justify="space-between" wrap="nowrap" gap="xs">
              <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {enNumber(line.qty)} عدد × {enCurrency(line.unitPrice, false)}
              </Text>
              {lineAction(line)}
            </Group>
            {index < items.length - 1 ? <Divider variant="dashed" /> : null}
          </Stack>
        ))}
        <Divider />
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Text size="sm" fw={700}>
            جمع اقلام
          </Text>
          <Text size="sm" fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {enCurrency(total, false)}
          </Text>
        </Group>
      </Stack>
    </>
  );
}
