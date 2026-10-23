'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconAlertCircle,
  IconCircleCheck,
  IconPackageImport,
  IconWallet,
} from '@tabler/icons-react';
import { Button, Group, NumberInput, SegmentedControl, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import ResponsiveModal from '@/components/ui/panel/ResponsiveModal';
import { enCurrency, enNumber } from '@/lib/format';
import {
  RETURN_METHOD_LABELS,
  RETURN_SHIPPING_PAYER_LABELS,
  type ReturnMethod,
  type ReturnShippingPayer,
  type ReturnStatus,
} from '@/lib/return-status';

export interface ReturnReviewControlsProps {
  displayId: string;
  status: ReturnStatus;
  /** سفارشِ مبنا تحویل حضوری بوده — روش برگشت فقط «مراجعه حضوری» است. */
  isPickupOrder: boolean;
  /** گزینه پیک مرجوعی در تنظیمات فروشگاه فعال است. */
  courierEnabled: boolean;
  defaultPayer: ReturnShippingPayer;
  /** مبلغ بازگشتی اقلام (قفل‌شده در تایید). */
  refundItemsAmount: number;
  /** هزینه ارسال اعلامی مشتری — فقط روش self_ship. */
  declaredShippingCost: number | null;
  /** روش/پرداخت‌کننده تعیین‌شده (پس از تایید). */
  returnMethod: ReturnMethod | null;
  shippingPayer: ReturnShippingPayer | null;
}

type ModalKind = 'approve' | 'reject' | 'receive' | 'settle' | null;

/**
 * کنترل‌های بررسی مرجوعی توسط کاربر بک‌آفیس — فقط «گام بعدی» نمایش داده
 * می‌شود (همان قاعده FulfillmentControls سفارش‌ها): تایید/رد روی «ثبت شده»،
 * ثبت دریافت روی «تایید/مدارک ثبت‌شده»، تسویه و واریز روی «کالا دریافت شد».
 * هر فرم ≤ ۴ فیلد است و داخل ResponsiveModal باز می‌شود.
 */
export default function ReturnReviewControls({
  displayId,
  status,
  isPickupOrder,
  courierEnabled,
  defaultPayer,
  refundItemsAmount,
  declaredShippingCost,
  returnMethod,
  shippingPayer,
}: ReturnReviewControlsProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalKind>(null);
  const [submitting, setSubmitting] = useState(false);

  // فرم تایید
  const [method, setMethod] = useState<ReturnMethod>(isPickupOrder ? 'in_person' : 'self_ship');
  const [payer, setPayer] = useState<ReturnShippingPayer>(defaultPayer);
  const [note, setNote] = useState('');
  // فرم رد
  const [rejectReason, setRejectReason] = useState('');
  // فرم تسویه
  const [approvedCost, setApprovedCost] = useState<number | ''>(declaredShippingCost ?? '');
  // بازگشت جزئی — خالی یعنی کل جمع محاسبه‌شده واریز شود.
  const [finalRefund, setFinalRefund] = useState<number | ''>('');

  function closeModal() {
    setModal(null);
  }

  async function post(body: Record<string, unknown>, successMessage: string) {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/returns/${encodeURIComponent(displayId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'عملیات ناموفق بود.',
          color: 'red',
          icon: <IconAlertCircle size={18} />,
        });
        return;
      }
      notifications.show({
        title: 'انجام شد',
        message: successMessage,
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
      closeModal();
      router.refresh();
    } catch {
      notifications.show({
        title: 'خطا',
        message: 'ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const methodOptions = [
    { value: 'self_ship', label: RETURN_METHOD_LABELS.self_ship },
    ...(courierEnabled
      ? [{ value: 'shop_courier', label: RETURN_METHOD_LABELS.shop_courier }]
      : []),
    ...(isPickupOrder ? [{ value: 'in_person', label: RETURN_METHOD_LABELS.in_person }] : []),
  ];

  const shippingRefundPreview =
    shippingPayer === 'shop' && returnMethod === 'self_ship'
      ? Math.min(
          typeof approvedCost === 'number' ? approvedCost : (declaredShippingCost ?? 0),
          declaredShippingCost ?? 0
        )
      : 0;

  return (
    <Group gap="xs" wrap="wrap" className="no-print">
      {status === 'requested' ? (
        <>
          <Button size="sm" onClick={() => setModal('approve')}>
            بررسی و تایید
          </Button>
          <Button size="sm" variant="light" color="red" onClick={() => setModal('reject')}>
            رد درخواست
          </Button>
        </>
      ) : null}

      {status === 'approved' || status === 'sent' ? (
        <Button
          size="sm"
          leftSection={<IconPackageImport size={16} />}
          onClick={() => setModal('receive')}
        >
          ثبت دریافت کالا
        </Button>
      ) : null}

      {status === 'received' ? (
        <Button size="sm" leftSection={<IconWallet size={16} />} onClick={() => setModal('settle')}>
          تسویه و واریز به کیف پول
        </Button>
      ) : null}

      {status === 'refunded' ? (
        <Text size="sm" c="dimmed">
          تسویه شده — مبلغ به کیف پول مشتری واریز شد.
        </Text>
      ) : null}
      {status === 'rejected' ? (
        <Text size="sm" c="dimmed">
          این درخواست رد شده است.
        </Text>
      ) : null}
      {status === 'cancelled' ? (
        <Text size="sm" c="dimmed">
          این درخواست توسط مشتری لغو شده است.
        </Text>
      ) : null}

      {/* --- تایید: روش برگشت + پرداخت‌کننده هزینه ارسال + پیام به مشتری --- */}
      <ResponsiveModal
        opened={modal === 'approve'}
        onClose={closeModal}
        title="تایید درخواست مرجوعی"
      >
        <Stack gap="sm">
          {isPickupOrder ? (
            <Text size="xs" c="dimmed">
              سفارشِ مبنا تحویل حضوری بوده است؛ برگشت کالا فقط با مراجعه حضوری مشتری انجام می‌شود.
            </Text>
          ) : (
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                روش برگشت کالا
              </Text>
              <SegmentedControl
                fullWidth
                value={method}
                onChange={(value) => setMethod(value as ReturnMethod)}
                data={methodOptions}
                orientation={methodOptions.length > 2 ? 'vertical' : 'horizontal'}
              />
              {method === 'shop_courier' ? (
                <Text size="xs" c="dimmed">
                  پیک فروشگاه بسته را از محل مشتری تحویل می‌گیرد؛ پس از آماده‌شدن بسته، دریافت را
                  ثبت کنید.
                </Text>
              ) : null}
              {method === 'self_ship' ? (
                <Text size="xs" c="dimmed">
                  مشتری کالا را ارسال می‌کند و رسید مرسوله و هزینه ارسال را در سایت ثبت می‌کند.
                </Text>
              ) : null}
            </Stack>
          )}

          {method === 'self_ship' ? (
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                هزینه ارسال برگشت با کیست؟
              </Text>
              <SegmentedControl
                fullWidth
                value={payer}
                onChange={(value) => setPayer(value as ReturnShippingPayer)}
                data={[
                  { value: 'customer', label: RETURN_SHIPPING_PAYER_LABELS.customer },
                  { value: 'shop', label: RETURN_SHIPPING_PAYER_LABELS.shop },
                ]}
              />
              <Text size="xs" c="dimmed">
                با انتخاب «فروشگاه»، هزینه اعلامی مشتری پس از دریافت کالا به کیف پولش اضافه می‌شود.
              </Text>
            </Stack>
          ) : null}

          <Textarea
            label="پیام به مشتری (اختیاری)"
            minRows={2}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
          />

          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={closeModal} disabled={submitting}>
              انصراف
            </Button>
            <Button
              loading={submitting}
              onClick={() =>
                void post(
                  {
                    action: 'approve',
                    returnMethod: method,
                    shippingPayer: method === 'self_ship' ? payer : undefined,
                    approvalNote: note,
                  },
                  `درخواست ${displayId} تایید شد.`
                )
              }
            >
              تایید درخواست
            </Button>
          </Group>
        </Stack>
      </ResponsiveModal>

      {/* --- رد: ذکر علت اجباری --- */}
      <ResponsiveModal opened={modal === 'reject'} onClose={closeModal} title="رد درخواست مرجوعی">
        <Stack gap="sm">
          <Textarea
            label="علت رد"
            description="این متن در تایم‌لاین مشتری نمایش داده می‌شود."
            minRows={3}
            maxLength={500}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.currentTarget.value)}
            required
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={closeModal} disabled={submitting}>
              انصراف
            </Button>
            <Button
              color="red"
              loading={submitting}
              onClick={() =>
                void post({ action: 'reject', rejectReason }, `درخواست ${displayId} رد شد.`)
              }
            >
              رد درخواست
            </Button>
          </Group>
        </Stack>
      </ResponsiveModal>

      {/* --- دریافت کالا: تایید ساده --- */}
      <ResponsiveModal
        opened={modal === 'receive'}
        onClose={closeModal}
        title="ثبت دریافت کالای مرجوعی"
      >
        <Stack gap="sm">
          <Text size="sm">
            کالای مرجوعی {displayId} دریافت شده است؟ پس از ثبت دریافت می‌توانید تسویه و واریز به کیف
            پول را انجام دهید.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={closeModal} disabled={submitting}>
              انصراف
            </Button>
            <Button
              loading={submitting}
              onClick={() => void post({ action: 'receive' }, `دریافت کالای ${displayId} ثبت شد.`)}
            >
              ثبت دریافت
            </Button>
          </Group>
        </Stack>
      </ResponsiveModal>

      {/* --- تسویه: واریز مبلغ کالاها + هزینه ارسال (وقتی با فروشگاه است)؛
              مبلغ نهایی قابل کاهش است = بازگشت جزئی --- */}
      <ResponsiveModal
        opened={modal === 'settle'}
        onClose={closeModal}
        title="تسویه و واریز به کیف پول"
      >
        <Stack gap="sm">
          <Text size="sm">
            مبلغ کالاهای مرجوعی {displayId}: {enCurrency(refundItemsAmount, false)}
          </Text>
          <Text size="xs" c="dimmed">
            این مبلغ، سهم تناسبی همین اقلام از پرداختیِ واقعی مشتری پس از تخفیف‌های سفارش است — نه
            جمع قیمت واحدها.
          </Text>
          {shippingPayer === 'shop' && returnMethod === 'self_ship' ? (
            <NumberInput
              label="هزینه ارسال برگشت تاییدشده (تومان)"
              description={`هزینه اعلامی مشتری: ${enCurrency(declaredShippingCost ?? 0, false)} — بیش از آن قابل تایید نیست.`}
              min={0}
              max={declaredShippingCost ?? 0}
              thousandSeparator=","
              value={approvedCost}
              onChange={(value) => setApprovedCost(typeof value === 'number' ? value : '')}
            />
          ) : null}
          <NumberInput
            label="مبلغ نهایی بازگشتی (تومان)"
            description="خالی = کل جمع محاسبه‌شده — عدد کمتر یعنی بازگشت جزئی به کیف پول مشتری."
            min={0}
            max={refundItemsAmount + shippingRefundPreview}
            thousandSeparator=","
            placeholder={enNumber(refundItemsAmount + shippingRefundPreview)}
            value={finalRefund}
            onChange={(value) => setFinalRefund(typeof value === 'number' ? value : '')}
          />
          <Text size="sm" fw={600}>
            جمع واریزی:{' '}
            {enCurrency(
              finalRefund === '' ? refundItemsAmount + shippingRefundPreview : finalRefund,
              false
            )}
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={closeModal} disabled={submitting}>
              انصراف
            </Button>
            <Button
              loading={submitting}
              leftSection={<IconWallet size={16} />}
              onClick={() =>
                void post(
                  {
                    action: 'settle',
                    approvedShippingCost:
                      shippingPayer === 'shop' &&
                      returnMethod === 'self_ship' &&
                      approvedCost !== ''
                        ? approvedCost
                        : undefined,
                    refundAmount: finalRefund === '' ? undefined : finalRefund,
                  },
                  `${enCurrency(
                    finalRefund === '' ? refundItemsAmount + shippingRefundPreview : finalRefund,
                    false
                  )} به کیف پول مشتری واریز شد.`
                )
              }
            >
              واریز به کیف پول
            </Button>
          </Group>
        </Stack>
      </ResponsiveModal>
    </Group>
  );
}
