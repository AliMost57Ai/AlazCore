import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Card, Divider, Group, Image, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import CancelReturnButton from '@/components/account/CancelReturnButton';
import ReturnShipmentForm from '@/components/account/ReturnShipmentForm';
import ReturnTimeline from '@/components/returns/ReturnTimeline';
import { requireSession } from '@/lib/auth';
import { faCurrency, faJalaliDate, faNumber, toFaDigits } from '@/lib/format';
import { getCustomerReturnDetail } from '@/lib/product-returns';
import {
  customerNextStep,
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

export const metadata: Metadata = {
  title: 'جزئیات مرجوعی',
};

export const dynamic = 'force-dynamic';

/** برچسب تاریخ+ساعت رخداد تایم‌لاین — هم‌فرمت lib/shop-orders. */
function eventAtLabel(at: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${faJalaliDate(at)} ${toFaDigits(`${pad(at.getHours())}:${pad(at.getMinutes())}`)}`;
}

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
 * جزئیات یک درخواست مرجوعی برای صاحبش: وضعیت، گام بعدی، تایم‌لاین کامل،
 * اقلام و عکس‌ها، مدارک ارسال و اکشن‌های زمینه‌ای (لغو تا قبل از بررسی،
 * ثبت مدارک ارسال در روش خود-ارسال).
 */
export default async function AccountReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession('/account/returns');
  const { id } = await params;

  const detail = await getCustomerReturnDetail(id, session.sub);
  if (!detail) {
    notFound();
  }

  const status = detail.status as ReturnStatus;
  const method = detail.returnMethod as ReturnMethod | null;
  const payer = detail.shippingPayer as ReturnShippingPayer | null;
  // شفاف‌سازی مبلغ بازگشتی — جمع قیمت اقلام مرجوعی در برابر پرداختی واقعی
  // مشتری (بعد از تخفیف‌های سفارش). برابر بودن یعنی توضیحی لازم نیست.
  const returnedGross = detail.lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
  const paidGoodsTotal = Math.max(detail.order.amount - detail.order.discountAmount, 0);
  const reasonKind = (Object.keys(RETURN_REASON_LABELS) as ReturnReasonKind[]).includes(
    detail.reasonKind as ReturnReasonKind
  )
    ? (detail.reasonKind as ReturnReasonKind)
    : 'other';

  const events = detail.events.map((event) => ({
    toStatus: event.toStatus,
    message: event.message,
    actorRole: event.actorRole,
    createdAtLabel: eventAtLabel(event.createdAt),
  }));

  return (
    <Stack gap="md">
      <Card withBorder>
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Group gap="xs" wrap="nowrap">
              <Badge variant="light" color={RETURN_STATUS_COLORS[status]} radius="sm">
                {RETURN_STATUS_LABELS[status]}
              </Badge>
            </Group>
            <Text ff="monospace" fz="sm" fw={600}>
              {detail.displayId}
            </Text>
          </Group>

          <Divider />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={{ base: 4, sm: 'lg' }}>
            <Stack gap={6}>
              <DetailRow label="سفارش" value={detail.order.displayId} />
              <DetailRow label="تاریخ درخواست" value={eventAtLabel(detail.createdAt)} />
              <DetailRow label="علت مرجوعی" value={RETURN_REASON_LABELS[reasonKind]} />
            </Stack>
            <Stack gap={6}>
              <DetailRow
                label="مبلغ بازگشتی اقلام"
                value={`${faCurrency(detail.refundItemsAmount, false)}`}
              />
              {method ? <DetailRow label="روش برگشت" value={RETURN_METHOD_LABELS[method]} /> : null}
              {method === 'self_ship' && payer ? (
                <DetailRow label="هزینه ارسال با" value={RETURN_SHIPPING_PAYER_LABELS[payer]} />
              ) : null}
            </Stack>
          </SimpleGrid>

          <Text size="xs" c={status === 'rejected' || status === 'cancelled' ? 'dimmed' : 'brand'}>
            گام بعدی: {customerNextStep(status, method, payer)}
          </Text>

          {detail.approvalNote ? (
            <Text size="xs" c="dimmed">
              پیام فروشگاه: {detail.approvalNote}
            </Text>
          ) : null}
          {status === 'rejected' && detail.rejectReason ? (
            <Text size="xs" c="red.7">
              علت رد: {detail.rejectReason}
            </Text>
          ) : null}

          <Divider />

          <Stack gap={2}>
            {detail.lines.map((line) => (
              <Text key={`${line.productId}-${line.variantId ?? 'base'}`} size="xs" c="dimmed">
                {line.name} × {faNumber(line.qty)} — {faCurrency(line.unitPrice * line.qty, false)}
              </Text>
            ))}
          </Stack>

          {/* شفاف‌سازی محاسبه — مبلغ بازگشتی سهم تناسبی از پرداختی واقعی مشتری
              است؛ با تخفیف سفارش (کد تخفیف) از جمع قیمت اقلام کمتر است. */}
          {paidGoodsTotal < returnedGross ? (
            <Text size="xs" c="dimmed">
              جمع قیمت اقلام مرجوعی {faCurrency(returnedGross, false)} تومان است؛ مبلغ بازگشتی، سهم
              تناسبی همین اقلام از مبلغ واقعاً پرداختی شما پس از تخفیف‌های سفارش
              {detail.order.couponCode
                ? ` (کد تخفیف «${detail.order.couponCode}» — ${faCurrency(detail.order.discountAmount, false)} تومان)`
                : ''}{' '}
              است: {faCurrency(paidGoodsTotal, false)} تومان.
            </Text>
          ) : null}

          {detail.images.length > 0 ? (
            <Group gap="sm">
              {detail.images.map((path) => (
                <Image
                  key={path}
                  src={`/api/files/${path}`}
                  h={80}
                  w={80}
                  fit="cover"
                  radius="sm"
                  alt="تصویر مرجوعی"
                />
              ))}
            </Group>
          ) : null}
        </Stack>
      </Card>

      {status === 'requested' ? (
        <Group justify="flex-end">
          <CancelReturnButton returnId={detail.id} displayId={detail.displayId} />
        </Group>
      ) : null}

      {status === 'approved' && method === 'self_ship' && payer ? (
        <ReturnShipmentForm
          returnId={detail.id}
          shippingPayerLabel={RETURN_SHIPPING_PAYER_LABELS[payer]}
        />
      ) : null}

      {detail.shippingTrackingCode ? (
        <Card withBorder>
          <Stack gap={6}>
            <Text size="sm" fw={600}>
              مدارک ارسال مرسوله
            </Text>
            <DetailRow label="کد رهگیری" value={detail.shippingTrackingCode} />
            <DetailRow
              label="هزینه ارسال اعلامی"
              value={`${faCurrency(detail.shippingCost ?? 0, false)}`}
            />
            {detail.shippingReceiptPath ? (
              <>
                <Text size="xs" c="dimmed">
                  عکس رسید مرسوله (همین تصویر برای فروشگاه قابل مشاهده است):
                </Text>
                <Image
                  src={`/api/files/${detail.shippingReceiptPath}`}
                  h={120}
                  w="auto"
                  fit="contain"
                  radius="sm"
                  alt="عکس رسید مرسوله"
                />
              </>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      {status === 'refunded' ? (
        <Card withBorder>
          <Stack gap="xs">
            <Text size="sm" fw={600} c="green.7">
              تسویه انجام شد
              {detail.refundedAmount != null
                ? ` — ${faCurrency(detail.refundedAmount, false)} به کیف پول شما واریز شده است.`
                : ' — مبالغ به کیف پول شما واریز شده است.'}
            </Text>
            {detail.refundedAmount != null &&
            detail.refundedAmount < detail.refundItemsAmount ? (
              <Text size="xs" c="dimmed">
                مبلغ واریزشده کمتر از جمع محاسبه‌شده است — فروشگاه بازگشت جزئی انجام داده؛ جزئیات
                در تایم‌لاین و پیام فروشگاه.
              </Text>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      <Card withBorder>
        <Title order={3} fz="h6" mb="md">
          مراحل درخواست
        </Title>
        {events.length > 0 ? <ReturnTimeline events={events} /> : null}
      </Card>
    </Stack>
  );
}
