import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Badge, Card, Divider, Group, Image, SimpleGrid, Stack, Text } from '@mantine/core';
import PageHeader from '@/components/layout/PageHeader';
import ReturnReviewControls from '@/components/returns/ReturnReviewControls';
import ReturnTimeline from '@/components/returns/ReturnTimeline';
import OrderItemsDetail from '@/components/ui/panel/OrderItemsDetail';
import PanelBackButton from '@/components/ui/panel/PanelBackButton';
import { canAccessMenu, requireSession } from '@/lib/auth';
import { enCurrency, faJalaliDate, enNumber } from '@/lib/format';
import { getReturnDetail } from '@/lib/product-returns';
import {
  RETURN_METHOD_LABELS,
  RETURN_REASON_LABELS,
  RETURN_SHIPPING_PAYER_LABELS,
  RETURN_STATUS_COLORS,
  RETURN_STATUS_LABELS,
  type ReturnMethod,
  type ReturnReasonKind,
  type ReturnShippingPayer,
  type ReturnStatus,
} from '@/lib/return-status';
import { getAppSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'جزئیات مرجوعی',
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="xs" wrap="nowrap">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="xs" fw={500} style={{ whiteSpace: 'nowrap' }}>
        {value}
      </Text>
    </Group>
  );
}

/**
 * صفحه اختصاصی جزئیات یک درخواست مرجوعی — دسکتاپ و موبایل هر دو همین صفحه
 * (قاعده «جزئیات موبایل = صفحه اختصاصی»): مشخصات و وضعیت، اقلام، عکس‌های
 * درخواست و رسید ارسال، تایم‌لاین کامل و کنترل‌های بررسی (تایید/رد/دریافت/
 * تسویه) برای نقش‌های دارای مجوز ویرایش.
 */
export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('/returns');
  if (!canAccessMenu(session, '/returns')) {
    redirect('/dashboard');
  }
  const { id } = await params;

  const [detail, settings] = await Promise.all([getReturnDetail(id), getAppSettings()]);
  if (!detail) {
    notFound();
  }
  const canEdit = canAccessMenu(session, '/returns', 'edit');

  const status = detail.status as ReturnStatus;
  const method = detail.returnMethod as ReturnMethod | null;
  const payer = detail.shippingPayer as ReturnShippingPayer | null;
  const reasonKind = (Object.keys(RETURN_REASON_LABELS) as ReturnReasonKind[]).includes(
    detail.reasonKind as ReturnReasonKind
  )
    ? (detail.reasonKind as ReturnReasonKind)
    : 'other';
  const isPickupOrder = Boolean(detail.order.pickupSlotId);
  // شفاف‌سازی مبلغ بازگشتی — جمع قیمت اقلام مرجوعی در برابر پرداختی واقعی
  // مشتری (بعد از تخفیف‌های سفارش). برابر بودن یعنی توضیحی لازم نیست.
  const returnedGross = detail.lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
  const paidGoodsTotal = Math.max(detail.order.amount - detail.order.discountAmount, 0);

  const events = detail.events.map((event) => ({
    toStatus: event.toStatus,
    message: event.message,
    actorRole: event.actorRole,
    createdAtLabel: `${faJalaliDate(event.createdAt)}`,
  }));

  return (
    <Stack gap="lg">
      <PanelBackButton />
      <PageHeader
        title={`مرجوعی ${detail.displayId}`}
        description={`سفارش ${detail.order.displayId} — ${detail.user.name}`}
        actions={
          canEdit ? (
            <ReturnReviewControls
              displayId={detail.displayId}
              status={status}
              isPickupOrder={isPickupOrder}
              courierEnabled={settings.returnCourierEnabled}
              defaultPayer={settings.returnDefaultShipPayer === 'shop' ? 'shop' : 'customer'}
              refundItemsAmount={detail.refundItemsAmount}
              declaredShippingCost={detail.shippingCost}
              returnMethod={method}
              shippingPayer={payer}
            />
          ) : undefined
        }
      />

      <Card withBorder>
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Badge variant="light" color={RETURN_STATUS_COLORS[status]} radius="sm">
              {RETURN_STATUS_LABELS[status]}
            </Badge>
            <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
              ثبت: {faJalaliDate(detail.createdAt)}
            </Text>
          </Group>

          <Divider />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={{ base: 4, sm: 'lg' }}>
            <Stack gap={6}>
              <DetailRow label="مشتری" value={detail.user.name} />
              <DetailRow label="موبایل" value={detail.user.phone ?? '—'} />
              <DetailRow label="علت مرجوعی" value={RETURN_REASON_LABELS[reasonKind]} />
              <DetailRow
                label="مبلغ بازگشتی اقلام"
                value={`${enCurrency(detail.refundItemsAmount, false)}`}
              />
            </Stack>
            <Stack gap={6}>
              {method ? <DetailRow label="روش برگشت" value={RETURN_METHOD_LABELS[method]} /> : null}
              {method === 'self_ship' && payer ? (
                <DetailRow label="هزینه ارسال با" value={RETURN_SHIPPING_PAYER_LABELS[payer]} />
              ) : null}
              {detail.shippingTrackingCode ? (
                <DetailRow label="کد رهگیری مرسوله برگشتی" value={detail.shippingTrackingCode} />
              ) : null}
              {detail.shippingCost != null ? (
                <DetailRow
                  label="هزینه ارسال اعلامی"
                  value={`${enCurrency(detail.shippingCost, false)}`}
                />
              ) : null}
              {status === 'refunded' && detail.refundedAmount != null ? (
                <DetailRow
                  label="مبلغ واریزشده به مشتری"
                  value={`${enCurrency(detail.refundedAmount, false)}`}
                />
              ) : null}
              {status === 'refunded' && detail.refundedAt ? (
                <DetailRow label="تاریخ تسویه" value={faJalaliDate(detail.refundedAt)} />
              ) : null}
            </Stack>
          </SimpleGrid>

          {detail.approvalNote ? (
            <Text size="xs" c="dimmed">
              پیام فروشگاه به مشتری: {detail.approvalNote}
            </Text>
          ) : null}
          {status === 'rejected' && detail.rejectReason ? (
            <Text size="xs" c="red.7">
              علت رد: {detail.rejectReason}
            </Text>
          ) : null}
        </Stack>
      </Card>

      <Card withBorder>
        <Text size="sm" fw={600} mb="sm">
          توضیح مشتری
        </Text>
        <Text size="sm" c="dimmed">
          {detail.reason}
        </Text>
      </Card>

      <Card withBorder>
        <Text size="sm" fw={600} mb="sm">
          اقلام مرجوعی ({enNumber(detail.lines.reduce((sum, line) => sum + line.qty, 0))} قلم)
        </Text>
        <OrderItemsDetail items={detail.lines} />
        {/* شفاف‌سازی محاسبه — مبلغ بازگشتی سهم تناسبی از پرداختی واقعی مشتری
            است، نه جمع قیمت واحدها؛ با تخفیف سفارش (کد تخفیف) کمتر دیده می‌شود. */}
        {paidGoodsTotal < returnedGross ? (
          <Text size="xs" c="dimmed" mt="sm">
            جمع قیمت اقلام مرجوعی {enCurrency(returnedGross, false)} تومان است؛ مبلغ بازگشتی، سهم
            تناسبی همین اقلام از پرداختی واقعی مشتری پس از تخفیف‌های سفارش
            {detail.order.couponCode
              ? ` (کد تخفیف «${detail.order.couponCode}» — ${enCurrency(detail.order.discountAmount, false)} تومان)`
              : ''}{' '}
            است: {enCurrency(paidGoodsTotal, false)} تومان.
          </Text>
        ) : null}
      </Card>

      {detail.images.length > 0 || detail.shippingReceiptPath ? (
        <Card withBorder>
          <Text size="sm" fw={600} mb="sm">
            تصاویر
          </Text>
          <Stack gap="md">
            {detail.images.length > 0 ? (
              <Stack gap={6}>
                <Text size="xs" c="dimmed">
                  تصاویر علت مرجوعی (از فرم درخواست مشتری)
                </Text>
                <Group gap="sm">
                  {detail.images.map((path) => (
                    <Image
                      key={path}
                      src={`/api/files/${path}`}
                      h={96}
                      w={96}
                      fit="cover"
                      radius="sm"
                      alt="تصویر درخواست مرجوعی"
                    />
                  ))}
                </Group>
              </Stack>
            ) : null}
            {detail.shippingReceiptPath ? (
              <Stack gap={6}>
                <Text size="xs" c="dimmed">
                  عکس رسید مرسوله (ثبت مدارک ارسال توسط مشتری)
                </Text>
                <Image
                  src={`/api/files/${detail.shippingReceiptPath}`}
                  h={120}
                  w="auto"
                  fit="contain"
                  radius="sm"
                  alt="عکس رسید مرسوله"
                />
              </Stack>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      <Card withBorder>
        <Text size="sm" fw={600} mb="md">
          مراحل درخواست
        </Text>
        <ReturnTimeline events={events} />
      </Card>
    </Stack>
  );
}
