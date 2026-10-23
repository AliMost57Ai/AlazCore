import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Badge, Card, Group, Stack, Text } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import OrderItemsDetail from '@/components/ui/panel/OrderItemsDetail';
import PanelBackButton from '@/components/ui/panel/PanelBackButton';
import { listOrderAccounts } from '@/lib/accounting';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { enCurrency } from '@/lib/format';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/order-status';
import { getOrderByDisplayId } from '@/lib/orders';
import { pickupOrdersList } from '@/lib/pickup';

export const metadata: Metadata = {
  title: 'جزئیات سفارش',
};

type PageProps = { params: Promise<{ id: string }> };

/** ردیف کلید/مقدار کارت جزئیات — ساختار واحد همه بخش‌های این صفحه. */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text size="sm" ta="end">
        {children}
      </Text>
    </Group>
  );
}

/**
 * صفحه واحد جزئیات سفارش — مقصد مشترک کارت موبایل هر سه لیست (سفارش‌ها،
 * تحویل حضوری، حسابداری). قاعده پنل: جزئیات در موبایل صفحه اختصاصی باز
 * می‌شود، نه مودال نه آکاردئون. اقلام + خلاصه سفارش + داستان پول (وقتی سفارش
 * حساب‌دار است) + برنامه تحویل حضوری (وقتی رزرو است) در یک چیدمان تک‌ستونه
 * بدون اسکرول افقی.
 */
export default async function OrderDetailPage({ params }: PageProps) {
  const session = await requireSession('/orders');
  // مقصد مشترک سه لیست است — ورود با هر مجوزی که یکی از آن‌ها را باز می‌کند.
  const canOrders = canAccessMenu(session, '/orders');
  const canPickup = canAccessMenu(session, '/orders/pickup');
  const canAccounting = canAccessMenu(session, '/accounting');
  if (!canOrders && !canPickup && !canAccounting) {
    redirect('/dashboard');
  }
  // حذف قلم — عملیات editِ سفارش‌ها؛ فقط مالک/کارشناسِ مجاز دکمه را می‌بیند.
  const canEditOrders = canAccessMenu(session, '/orders', 'edit');
  const { id } = await params;
  const displayId = decodeURIComponent(id);
  const order = await getOrderByDisplayId(displayId);
  if (!order) {
    notFound();
  }

  const itemRemovalAllowed =
    canEditOrders && (order.status === 'paid' || order.status === 'boxing');

  // داستان پول و رزرو تحویل حضوری فقط با مجوز همان بخش خوانده و نشان داده
  // می‌شود — جستجو بر displayId و تطبیق دقیق.
  const [accounts, pickupOrders] = await Promise.all([
    canAccounting ? listOrderAccounts(displayId) : Promise.resolve([]),
    canPickup ? pickupOrdersList('all', displayId) : Promise.resolve([]),
  ]);
  const account = accounts.find((row) => row.displayId === displayId) ?? null;
  const pickup = pickupOrders.find((row) => row.displayId === displayId) ?? null;

  return (
    <Stack gap="lg">
      <Group gap="xs" className="no-print">
        <PanelBackButton />
      </Group>

      <PageHeader
        title={`جزئیات سفارش ${order.id}`}
        description={`${order.customer} — ${order.date}`}
      />

      <Card padding="lg" withBorder>
        <Stack gap="sm">
          <DetailRow label="وضعیت">
            <Badge variant="light" color={STATUS_COLORS[order.status]}>
              {STATUS_LABELS[order.status]}
            </Badge>
          </DetailRow>
          {order.oversell ? (
            <DetailRow label="خالی‌فروشی">
              <Badge variant="light" color="orange" radius="sm">
                {order.oversellBlocked
                  ? 'نیازمند افزایش موجودی — بسته‌بندی قفل است'
                  : 'موجودی تامین شد — قابل ادامه'}
              </Badge>
            </DetailRow>
          ) : null}
          {order.shopNote ? (
            <DetailRow label="پیام فروشگاه به مشتری">
              <Text size="sm">{order.shopNote}</Text>
            </DetailRow>
          ) : null}
          <DetailRow label="مبلغ سفارش">
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
              {enCurrency(order.amount, false)}
            </span>
          </DetailRow>
          {order.phone ? (
            <DetailRow label="موبایل مشتری">
              <Text size="sm" dir="ltr" ff="monospace" component="span">
                {order.phone}
              </Text>
            </DetailRow>
          ) : null}
          {order.trackingCode ? (
            <DetailRow label="کد رهگیری">
              <Text size="sm" dir="ltr" ff="monospace" component="span">
                {order.trackingCode}
              </Text>
            </DetailRow>
          ) : null}
        </Stack>
      </Card>

      <Card padding="lg" withBorder>
        <Text size="xs" fw={700} c="dimmed" mb="sm">
          اقلام سفارش
        </Text>
        <OrderItemsDetail
          items={order.items}
          remove={
            itemRemovalAllowed
              ? { orderDisplayId: order.id, status: order.status as 'paid' | 'boxing' }
              : undefined
          }
        />
      </Card>

      {account ? (
        <Card padding="lg" withBorder>
          <Text size="xs" fw={700} c="dimmed" mb="sm">
            گردش مالی سفارش
          </Text>
          <Stack gap="sm">
            <DetailRow label="روش تحویل">
              {account.deliveryKind === 'pickup' ? 'حضوری' : 'ارسالی'} —{' '}
              {account.deliveryMethodLabel}
            </DetailRow>
            <DetailRow label="قیمت اصلی">
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {enCurrency(account.baseAmount, false)}
              </span>
            </DetailRow>
            {account.productDiscount > 0 ? (
              <DetailRow label="تخفیف کالا">
                <Text size="sm" c="orange.7" fw={600} component="span">
                  −{enCurrency(account.productDiscount, false)}
                </Text>
              </DetailRow>
            ) : null}
            {account.couponCode ? (
              <DetailRow label={`کد تخفیف (${account.couponCode})`}>
                <Text size="sm" c="orange.7" fw={600} component="span">
                  −{enCurrency(account.discountAmount, false)}
                </Text>
              </DetailRow>
            ) : null}
            <DetailRow label="قابل پرداخت">
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                {enCurrency(account.payable, false)}
              </span>
            </DetailRow>
            {account.onlinePaid > 0 ? (
              <DetailRow label="پرداخت آنلاین">
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {enCurrency(account.onlinePaid, false)}
                </span>
              </DetailRow>
            ) : null}
            {account.walletPaid > 0 ? (
              <DetailRow label="از کیف پول">
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {enCurrency(account.walletPaid, false)}
                </span>
              </DetailRow>
            ) : null}
            {account.refunded > 0 ? (
              <DetailRow label="بازگشت به کیف پول">
                <Text size="sm" c="red" fw={600} component="span">
                  {enCurrency(account.refunded, false)}
                </Text>
              </DetailRow>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      {pickup ? (
        <Card padding="lg" withBorder>
          <Text size="xs" fw={700} c="dimmed" mb="sm">
            برنامه تحویل حضوری
          </Text>
          <Stack gap="sm">
            <DetailRow label="نقطه تحویل">{pickup.locationTitle}</DetailRow>
            <DetailRow label="آدرس">{pickup.locationAddress}</DetailRow>
            <DetailRow label="روز تحویل">{pickup.pickupDateLabel}</DetailRow>
            <DetailRow label="بازه زمانی">{pickup.slotLabel}</DetailRow>
            {pickup.changeNote ? (
              <DetailRow label={`آخرین تغییر برنامه (${pickup.changeAt})`}>
                <Text size="sm" c="orange.7" component="span">
                  {pickup.changeNote}
                </Text>
              </DetailRow>
            ) : null}
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
