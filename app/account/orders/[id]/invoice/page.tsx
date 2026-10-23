import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Button, Group, Image, Stack, Text } from '@mantine/core';
import classes from './invoice.module.css';
import PrintButton from '@/components/layout/PrintButton';
import { requireSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { faCurrency, faJalaliLongDate, faNumber } from '@/lib/format';
import { STATUS_COLORS, STATUS_LABELS, type OrderStatus } from '@/lib/order-status';
import { parseItems } from '@/lib/shop-orders';
import { getSiteSettings } from '@/lib/theme-settings';

export const metadata: Metadata = {
  title: 'فاکتور فروش',
};

export const dynamic = 'force-dynamic';

/**
 * فاکتور فروش سفارش — از مرحلهٔ پرداخت به بعد، برای صاحب سفارش. سربرگ با لوگو
 * و نام فروشگاه + شمارهٔ سفارش و تاریخ خرید؛ جدول اقلام با ستون‌های «قیمت
 * جلد / تعداد / تخفیف / قیمت پس از تخفیف / مبلغ کل» و ردیف‌های جمع کل، هزینهٔ
 * ارسال و مبلغ نهایی پرداخت — قابل چاپ (PrintButton + @media print).
 */
export default async function OrderInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('/account/orders');
  const { id } = await params;

  // displayId + مالکیت هم‌زمان چک می‌شوند — فاکتور هر کاربر فقط سفارش خودش.
  const order = await prisma.order.findFirst({
    where: { displayId: id, userId: session.sub },
  });
  if (!order || order.status === 'pending' || order.status === 'cancelled') {
    notFound();
  }

  const site = await getSiteSettings();
  const items = parseItems(order.itemsJson);
  const purchaseAt = order.paidAt ?? order.createdAt;
  const status = order.status as OrderStatus;
  const isPickup = Boolean(order.pickupSlotId);

  // ستون‌ها به‌صورت جمعِ خط تا با هم جمع‌پذیر باشند — سفارش قدیمیِ بدون
  // listPrice ستون تخفیفش «—» است و قیمت کالایش همان قیمت فروش.
  const rows = items.map((item) => {
    const cover = (item.listPrice ?? item.unitPrice) * item.qty;
    const total = item.unitPrice * item.qty;
    return {
      key: `${item.productId}-${item.variantId ?? 'base'}`,
      name: item.name,
      qty: item.qty,
      cover,
      discount: item.listPrice === undefined ? null : cover - total,
      total,
    };
  });

  const couponDiscount = order.discountAmount;
  const invoiceTotal = Math.max(order.amount - couponDiscount, 0);
  const finalTotal = invoiceTotal + order.shippingCost;

  return (
    <Stack gap="md" className={classes.doc}>
      <Group justify="space-between" gap="sm" className={classes.toolbar} wrap="nowrap">
        {/* component="a" — نه component={Link}: این صفحه Server Component است و
            پاس‌دادن مرجع تابع به کامپوننت کلاینتی ممنوع (خطای RSC). */}
        <Button component="a" href="/account/orders" variant="subtle" color="gray">
          بازگشت به سفارش‌های من
        </Button>
        <PrintButton label="چاپ فاکتور" />
      </Group>

      <Stack gap="sm" className={classes.header}>
        <Group justify="space-between" wrap="nowrap" gap="md">
          <Group gap="sm" wrap="nowrap">
            {site.logoPath ? (
              <Image
                src={`/api/files/${site.logoPath}`}
                h={48}
                w="auto"
                fit="contain"
                alt={site.siteName}
              />
            ) : null}
            <Stack gap={2}>
              <Text fw={700} fz="lg">
                {site.siteName}
              </Text>
              {site.contactPhone ? (
                <Text size="xs" c="dimmed">
                  تلفن: {site.contactPhone}
                </Text>
              ) : null}
            </Stack>
          </Group>
          <Stack gap={2} align="flex-end">
            <Text fw={700} fz="lg">
              فاکتور فروش
            </Text>
            <Text ff="monospace" fz="sm">
              {order.displayId}
            </Text>
          </Stack>
        </Group>

        <Group gap="xs" wrap="wrap">
          <Badge variant="light" color={STATUS_COLORS[status]} radius="sm">
            {STATUS_LABELS[status]}
          </Badge>
          <Text size="sm" c="dimmed">
            تاریخ خرید: {faJalaliLongDate(purchaseAt)}
          </Text>
          {order.customer ? (
            <Text size="sm" c="dimmed">
              خریدار: {order.customer}
            </Text>
          ) : null}
          <Text size="sm" c="dimmed">
            روش تحویل: {isPickup ? 'تحویل حضوری' : order.deliveryMethod || '—'}
          </Text>
          {order.trackingCode ? (
            <Text size="sm" c="dimmed">
              کد رهگیری: {order.trackingCode}
            </Text>
          ) : null}
        </Group>
      </Stack>

      <div className={classes.tableWrap}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th>عنوان کالا</th>
              <th>قیمت کالا</th>
              <th>تعداد</th>
              <th>تخفیف</th>
              <th>قیمت پس از تخفیف</th>
              <th>مبلغ کل</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.name}</td>
                <td className={classes.numCell}>{faCurrency(row.cover, false)}</td>
                <td className={classes.numCell}>{faNumber(row.qty)}</td>
                <td className={classes.numCell}>
                  {row.discount !== null && row.discount > 0
                    ? faCurrency(row.discount, false)
                    : '—'}
                </td>
                <td className={classes.numCell}>{faCurrency(row.total, false)}</td>
                <td className={classes.numCell}>{faCurrency(row.total, false)}</td>
              </tr>
            ))}
            {couponDiscount > 0 ? (
              <tr className={classes.footerRow}>
                <td colSpan={5}>
                  تخفیف کد {order.couponCode ? `«${order.couponCode}»` : 'تخفیف'}
                </td>
                <td className={classes.numCell}>−{faCurrency(couponDiscount, false)}</td>
              </tr>
            ) : null}
            <tr className={classes.footerRow}>
              <td colSpan={5}>جمع کل فاکتور</td>
              <td className={classes.numCell}>{faCurrency(invoiceTotal, false)}</td>
            </tr>
            <tr>
              <td colSpan={5}>
                هزینه ارسال{!isPickup && order.deliveryMethod ? ` (${order.deliveryMethod})` : ''}
              </td>
              <td className={classes.numCell}>{faCurrency(order.shippingCost, false)}</td>
            </tr>
            <tr className={classes.footerRow}>
              <td colSpan={5}>مبلغ نهایی پرداخت</td>
              <td className={classes.numCell}>{faCurrency(finalTotal, false)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Text size="xs" c="dimmed" ta="center">
        این فاکتور در تاریخ {faJalaliLongDate(purchaseAt)} توسط {site.siteName} صادر شده است.
      </Text>
    </Stack>
  );
}
