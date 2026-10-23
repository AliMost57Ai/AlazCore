'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconAlertCircle,
  IconCircleCheck,
  IconCreditCard,
  IconMapPin,
  IconSend,
  IconTicket,
  IconTruck,
  IconWallet,
} from '@tabler/icons-react';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Radio,
  RadioGroup,
  SimpleGrid,
  Stack,
  Stepper,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import PhoneInput from '@/components/ui/PhoneInput';
import { faCurrency, faNumber, fromFaDigits } from '@/lib/format';
import type { OrderItem } from '@/lib/shop-orders';

/** The bits of an order the checkout flow needs. */
export interface CheckoutOrder {
  id: string;
  displayId: string;
  amount: number;
  items: OrderItem[];
}

interface AddressDTO {
  id: string;
  title: string;
  receiverName: string;
  receiverPhone: string;
  body: string;
  postalCode: string;
}

/** One gateway option in the customer's picker (plain data — no server imports). */
export interface CheckoutGateway {
  id: string;
  label: string;
  /** 'ipg' = online card payment, 'bnpl' = اعتباری/اقساطی. */
  kind: 'ipg' | 'bnpl';
}

/** One delivery option in the customer's picker (plain data). */
export interface CheckoutShippingMethod {
  id: string;
  name: string;
  description: string;
  minDeliveryDays: number;
  minShippingCost: number;
  /** false = پس‌کرایه — the cost stays off the invoice. */
  isInvoiced: boolean;
}

export interface CheckoutFormProps {
  order: CheckoutOrder;
  /** The customer's wallet balance — orders are paid from the wallet. */
  walletBalance: number;
  /** The admin's active + configured gateways. */
  gateways: CheckoutGateway[];
  /** Preselected gateway id (the admin's default). */
  defaultGateway: string | null;
  /** The admin's active shipping methods (روش‌های ارسال). */
  shippingMethods: CheckoutShippingMethod[];
  /**
   * Where the buyer lands after a wallet payment settles the order — customers
   * go to their orders list, staff (who have no /account pages) back to the
   * shop. Gateway redirects return to the orders page regardless.
   */
  successHref?: string;
}

/** Posts hidden fields to a relay gateway's URL via a temporary form. */
function submitRelay(postUrl: string, postFields: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = postUrl;
  for (const [name, value] of Object.entries(postFields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

/** The checkout state that survives a page refresh, per order. */
interface CheckoutDraft {
  step: number;
  addressId: string | null;
  shippingMethodId: string | null;
  gateway: string | null;
  coupon: { code: string; discount: number } | null;
}

function draftKey(orderId: string): string {
  return `checkout-draft:${orderId}`;
}

/** Reads the saved draft — absent/invalid parts are simply skipped. */
function readDraft(orderId: string): Partial<CheckoutDraft> {
  try {
    const raw = sessionStorage.getItem(draftKey(orderId));
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' ? (parsed as Partial<CheckoutDraft>) : {};
  } catch {
    // Private-browsing/quota quirks — refresh persistence is best effort.
    return {};
  }
}

function writeDraft(orderId: string, draft: CheckoutDraft): void {
  try {
    sessionStorage.setItem(draftKey(orderId), JSON.stringify(draft));
  } catch {
    // Best effort only.
  }
}

function clearDraft(orderId: string): void {
  try {
    sessionStorage.removeItem(draftKey(orderId));
  } catch {
    // Best effort only.
  }
}

/**
 * The checkout steps page: the ordered products and total are shown up front,
 * then the stepper walks the customer through picking (or adding) a delivery
 * address, confirming the delivery method, and paying. Payment always runs
 * through the wallet: with enough balance the order is paid instantly,
 * otherwise exactly the shortfall is charged online — through one of the
 * admin's active gateways (the default preselected) — and the callback tops
 * up the wallet and settles the order. Form-POST relay gateways (Saman /
 * Sepah / SizPay) are submitted through a hidden form instead of a redirect.
 */
export default function CheckoutForm({
  order,
  walletBalance,
  gateways,
  defaultGateway,
  shippingMethods,
  successHref = '/account/orders',
}: CheckoutFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [addresses, setAddresses] = useState<AddressDTO[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coupon state: the code typed so far, the checked-and-confirmed discount,
  // and the message from the pre-flight validation call.
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  // Gateway choice for the online shortfall charge — the admin's default (or
  // the first active gateway) starts preselected.
  const [gateway, setGateway] = useState(defaultGateway ?? gateways[0]?.id ?? 'zarinpal');

  // Shipping method (روش ارسال) — the first active method starts preselected.
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(
    shippingMethods[0]?.id ?? null
  );

  // Payment-link share (ارسال لینک پرداخت): the mobile the customer wants to
  // hand the invoice to, and the send state.
  const [linkMobile, setLinkMobile] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const shippingMethod = shippingMethods.find((method) => method.id === shippingMethodId) ?? null;
  // پس‌کرایه methods keep their cost off the invoice — settled at handover.
  const shippingCost = shippingMethod?.isInvoiced ? shippingMethod.minShippingCost : 0;

  const addressForm = useForm({
    mode: 'uncontrolled',
    initialValues: {
      title: '',
      receiverName: '',
      receiverPhone: '',
      body: '',
      postalCode: '',
    },
    validate: {
      title: (value) => (value.trim().length >= 2 ? null : 'عنوان باید حداقل ۲ نویسه باشد.'),
      receiverName: (value) =>
        value.trim().length >= 3 ? null : 'نام گیرنده باید حداقل ۳ نویسه باشد.',
      receiverPhone: (value) =>
        /^09\d{9}$/.test(fromFaDigits(value).trim())
          ? null
          : 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.',
      body: (value) => (value.trim().length >= 10 ? null : 'آدرس باید حداقل ۱۰ نویسه باشد.'),
      postalCode: (value) =>
        value.trim() === '' || /^\d{10}$/.test(fromFaDigits(value).trim())
          ? null
          : 'کد پستی باید ۱۰ رقم باشد.',
    },
  });

  const loadAddresses = useCallback(async () => {
    setLoadingAddresses(true);
    try {
      const response = await fetch('/api/addresses');
      if (response.ok) {
        const payload = (await response.json()) as { addresses: AddressDTO[] };
        setAddresses(payload.addresses);
        // Keep the current selection when it still exists; otherwise the
        // first saved address is the sensible default.
        setAddressId((current) => {
          const stillThere = payload.addresses.some((item) => item.id === current);
          return stillThere ? current : (payload.addresses[0]?.id ?? null);
        });
      }
    } catch {
      // The list stays empty; the customer can still add an address below.
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  // Restore the saved draft after mount (reading sessionStorage during the
  // first render would mismatch the server-rendered HTML). Values whose
  // option has since disappeared (deactivated shipping method, removed
  // gateway) are dropped.
  useEffect(() => {
    const draft = readDraft(order.id);
    if (typeof draft.step === 'number' && Number.isInteger(draft.step)) {
      setStep(Math.min(Math.max(draft.step, 0), 2));
    }
    if (draft.addressId) {
      setAddressId(draft.addressId);
    }
    if (draft.shippingMethodId && shippingMethods.some((m) => m.id === draft.shippingMethodId)) {
      setShippingMethodId(draft.shippingMethodId);
    }
    if (draft.gateway && gateways.some((g) => g.id === draft.gateway)) {
      setGateway(draft.gateway);
    }
    if (draft.coupon && typeof draft.coupon.code === 'string') {
      setCoupon(draft.coupon);
      setCouponInput(draft.coupon.code);
    }
    // Runs once per order — the picks live on in state afterwards.
  }, [order.id]);

  // Persist the flow so a refresh doesn't restart it from step one.
  useEffect(() => {
    writeDraft(order.id, { step, addressId, shippingMethodId, gateway, coupon });
  }, [order.id, step, addressId, shippingMethodId, gateway, coupon]);

  async function handleAddAddress(values: typeof addressForm.values) {
    setError(null);

    try {
      const response = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title.trim(),
          receiverName: values.receiverName.trim(),
          receiverPhone: fromFaDigits(values.receiverPhone).trim(),
          body: values.body.trim(),
          postalCode: fromFaDigits(values.postalCode).trim(),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        address?: AddressDTO;
        error?: string;
      };

      if (!response.ok || !payload.address) {
        setError(payload.error ?? 'ذخیره آدرس ناموفق بود.');
        return;
      }

      setAddresses((list) => [...list, payload.address as AddressDTO]);
      setAddressId(payload.address.id);
      setAddingAddress(false);
      addressForm.reset();
      notifications.show({
        title: 'آدرس ذخیره شد',
        message: 'آدرس جدید به فهرست شما افزوده شد.',
        color: 'green',
        icon: <IconMapPin size={16} />,
      });
    } catch {
      setError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.');
    }
  }

  const payable = coupon
    ? Math.max(order.amount - coupon.discount + shippingCost, 0)
    : order.amount + shippingCost;
  const shortfall = Math.max(payable - walletBalance, 0);

  async function handleCheckCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (code.length < 3) {
      setCouponError('کد تخفیف را وارد کنید.');
      return;
    }

    setCheckingCoupon(true);
    setCouponError(null);

    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, orderId: order.id }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        code?: string;
        discount?: number;
        error?: string;
      };

      if (!response.ok || !payload.code || payload.discount === undefined) {
        setCoupon(null);
        setCouponError(payload.error ?? 'بررسی کد تخفیف ناموفق بود.');
        return;
      }

      setCoupon({ code: payload.code, discount: payload.discount });
      setCouponInput(payload.code);
    } catch {
      setCouponError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.');
    } finally {
      setCheckingCoupon(false);
    }
  }

  async function handlePay() {
    if (!addressId) {
      setError('ابتدا یک آدرس تحویل انتخاب کنید.');
      return;
    }
    if (!shippingMethod) {
      setError('ابتدا یک روش ارسال انتخاب کنید.');
      return;
    }

    setPaying(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${order.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressId,
          couponCode: coupon?.code,
          gateway,
          shippingMethodId: shippingMethod.id,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        paid?: boolean;
        redirectUrl?: string;
        postUrl?: string | null;
        postFields?: Record<string, string> | null;
        chargeAmount?: number;
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? 'شروع پرداخت ناموفق بود.');
        setPaying(false);
        return;
      }

      if (payload.paid) {
        // Balance covered it — the order is already settled from the wallet.
        clearDraft(order.id);
        notifications.show({
          title: 'سفارش پرداخت شد',
          message: `سفارش ${order.displayId} با موجودی کیف پول پرداخت شد.`,
          color: 'green',
          icon: <IconCircleCheck size={18} />,
        });
        router.push(successHref);
        return;
      }

      if (payload.postUrl && payload.postFields) {
        // Relay gateways (Saman / Sepah / SizPay) take the browser there via a
        // form POST, not a redirect.
        submitRelay(payload.postUrl, payload.postFields);
        return;
      }

      if (payload.redirectUrl) {
        // Off to the gateway to charge exactly the shortfall — the browser
        // comes back to the orders page with the result.
        window.location.href = payload.redirectUrl;
        return;
      }

      setError('پاسخ پرداخت نامعتبر بود.');
      setPaying(false);
    } catch {
      setError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.');
      setPaying(false);
    }
  }

  /**
   * Shares this order's payment link: the checkout picks are snapshotted on
   * the order (same rules as paying) and the link SMS goes to the given
   * mobile. The recipient views and pays at /pay/{token} — no login needed.
   */
  async function handleSendPaymentLink() {
    if (!addressId) {
      setLinkError('ابتدا یک آدرس تحویل انتخاب کنید.');
      return;
    }
    if (!shippingMethod) {
      setLinkError('ابتدا یک روش ارسال انتخاب کنید.');
      return;
    }
    if (!/^09\d{9}$/.test(fromFaDigits(linkMobile).trim())) {
      setLinkError('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.');
      return;
    }

    setSendingLink(true);
    setLinkError(null);

    try {
      const response = await fetch(`/api/orders/${order.id}/payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: fromFaDigits(linkMobile).trim(),
          addressId,
          shippingMethodId: shippingMethod.id,
          couponCode: coupon?.code,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setLinkError(payload.error ?? 'ارسال لینک پرداخت ناموفق بود.');
        return;
      }

      notifications.show({
        title: 'لینک پرداخت ارسال شد',
        message: 'پیامک لینک پرداخت برای شماره واردشده ارسال شد.',
        color: 'green',
        icon: <IconCircleCheck size={18} />,
      });
      setLinkMobile('');
    } catch {
      setLinkError('ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.');
    } finally {
      setSendingLink(false);
    }
  }

  return (
    <Stack gap="md">
      <Title order={1} fz="h4">
        پرداخت سفارش {order.displayId}
      </Title>

      {/* The invoice up front: what's being bought and for how much. */}
      <Card withBorder padding="md">
        <Title order={2} fz="h6" mb="sm">
          اقلام سفارش
        </Title>
        <Stack gap="xs">
          {order.items.map((item) => (
            <Group
              key={`${item.productId}-${item.variantId ?? 'base'}`}
              justify="space-between"
              gap="xs"
              wrap="nowrap"
            >
              <Text size="sm" lineClamp={1}>
                {item.name}{' '}
                <Text component="span" size="sm" c="dimmed">
                  × {faNumber(item.qty)}
                </Text>
              </Text>
              <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
                {faCurrency(item.unitPrice * item.qty, false)}
              </Text>
            </Group>
          ))}
          <Divider />
          <Group justify="space-between">
            <Text fw={600}>جمع سفارش</Text>
            <Text fw={700}>{faCurrency(order.amount, false)}</Text>
          </Group>
          {coupon ? (
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap">
                <Badge
                  variant="light"
                  color="green"
                  radius="sm"
                  size="sm"
                  leftSection={<IconTicket size={12} />}
                >
                  {coupon.code}
                </Badge>
                <Text size="sm" c="green">
                  تخفیف
                </Text>
              </Group>
              <Text size="sm" fw={700} c="green" style={{ whiteSpace: 'nowrap' }}>
                −{faCurrency(coupon.discount, false)}
              </Text>
            </Group>
          ) : null}
          {shippingMethod ? (
            <Group justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap">
                <IconTruck size={14} />
                <Text size="sm" c={shippingMethod.isInvoiced ? undefined : 'dimmed'}>
                  هزینه ارسال ({shippingMethod.name})
                </Text>
              </Group>
              <Text
                size="sm"
                fw={600}
                c={shippingMethod.isInvoiced ? undefined : 'dimmed'}
                style={{ whiteSpace: 'nowrap' }}
              >
                {shippingMethod.isInvoiced
                  ? `+${faCurrency(shippingMethod.minShippingCost, false)}`
                  : 'پس‌کرایه (در فاکتور نمی‌آید)'}
              </Text>
            </Group>
          ) : null}
          <Divider />
          <Group justify="space-between">
            <Text fw={600}>مبلغ قابل پرداخت</Text>
            <Text fw={800}>{faCurrency(payable, false)}</Text>
          </Group>
        </Stack>

        {/* Discount code — pre-checked against this order before payment. */}
        {coupon ? (
          <Group gap="xs" mt="sm">
            <Text size="xs" c="dimmed">
              کد تخفیف ثبت شد و هنگام پرداخت اعمال می‌شود.
            </Text>
            <Anchor
              component="button"
              type="button"
              size="xs"
              c="red"
              onClick={() => {
                setCoupon(null);
                setCouponInput('');
                setCouponError(null);
              }}
            >
              حذف کد
            </Anchor>
          </Group>
        ) : (
          <Group gap="xs" mt="sm" align="flex-end" wrap="nowrap">
            <TextInput
              placeholder="کد تخفیف دارید؟"
              value={couponInput}
              onChange={(event) => setCouponInput(event.currentTarget.value)}
              error={couponError ?? undefined}
              style={{ flex: '1 1 160px' }}
              dir="ltr"
            />
            <Button variant="light" size="xs" loading={checkingCoupon} onClick={handleCheckCoupon}>
              بررسی کد
            </Button>
          </Group>
        )}
      </Card>

      <Card withBorder padding="md">
        <Stepper active={step} onStepClick={setStep} orientation="vertical" iconSize={30}>
          <Stepper.Step
            label="آدرس تحویل"
            description="نشانی ارسال سفارش را انتخاب کنید"
            icon={<IconMapPin size={18} />}
            allowStepSelect={step > 0}
          >
            <Stack gap="sm" mt="xs">
              {loadingAddresses ? (
                <Text size="sm" c="dimmed">
                  در حال بارگذاری آدرس‌ها…
                </Text>
              ) : addresses.length === 0 && !addingAddress ? (
                <Text size="sm" c="dimmed">
                  هنوز آدرسی ذخیره نکرده‌اید.
                </Text>
              ) : null}

              {addresses.length > 0 ? (
                <RadioGroup value={addressId ?? ''} onChange={setAddressId}>
                  <Stack gap="xs">
                    {addresses.map((address) => (
                      <Radio key={address.id} value={address.id} label={address.title} />
                    ))}
                  </Stack>
                </RadioGroup>
              ) : null}

              {addresses
                .filter((address) => address.id === addressId)
                .map((address) => (
                  <Text key={address.id} size="sm" c="dimmed">
                    {address.receiverName} — {address.body}
                    {address.postalCode ? ` (کدپستی ${address.postalCode})` : ''}
                  </Text>
                ))}

              {addingAddress ? (
                <form onSubmit={addressForm.onSubmit(handleAddAddress)} noValidate>
                  <Stack gap="sm">
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                      <TextInput
                        label="عنوان آدرس"
                        placeholder="مثلاً خانه"
                        required
                        key={addressForm.key('title')}
                        {...addressForm.getInputProps('title')}
                      />
                      <TextInput
                        label="نام گیرنده"
                        placeholder="مثلاً سارا محمدی"
                        required
                        key={addressForm.key('receiverName')}
                        {...addressForm.getInputProps('receiverName')}
                      />
                      <PhoneInput
                        label="موبایل گیرنده"
                        placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                        required
                        key={addressForm.key('receiverPhone')}
                        {...addressForm.getInputProps('receiverPhone')}
                      />
                      <TextInput
                        label="کد پستی (اختیاری)"
                        dir="ltr"
                        key={addressForm.key('postalCode')}
                        {...addressForm.getInputProps('postalCode')}
                      />
                    </SimpleGrid>
                    <TextInput
                      label="نشانی کامل"
                      placeholder="شهر، خیابان، پلاک و واحد"
                      required
                      key={addressForm.key('body')}
                      {...addressForm.getInputProps('body')}
                    />
                    <Group gap="sm">
                      <Button type="submit" size="xs">
                        ذخیره آدرس
                      </Button>
                      <Button
                        variant="subtle"
                        size="xs"
                        onClick={() => {
                          setAddingAddress(false);
                          addressForm.reset();
                        }}
                      >
                        انصراف
                      </Button>
                    </Group>
                  </Stack>
                </form>
              ) : (
                <Anchor
                  component="button"
                  type="button"
                  size="sm"
                  c="brand"
                  onClick={() => setAddingAddress(true)}
                >
                  + افزودن آدرس جدید
                </Anchor>
              )}

              <Group justify="flex-end" mt="xs">
                <Button
                  rightSection={<IconTruck size={16} />}
                  disabled={!addressId}
                  onClick={() => setStep(1)}
                >
                  مرحله بعد
                </Button>
              </Group>
            </Stack>
          </Stepper.Step>

          <Stepper.Step
            label="روش ارسال"
            description="نحوه ارسال سفارش شما"
            icon={<IconTruck size={18} />}
            allowStepSelect={step > 1 && Boolean(addressId)}
          >
            <Stack gap="sm" mt="xs">
              {shippingMethods.length === 0 ? (
                <Text size="sm" c="dimmed">
                  در حال حاضر روش ارسالی تعریف نشده است؛ برای ادامه با پشتیبانی تماس بگیرید.
                </Text>
              ) : (
                <RadioGroup value={shippingMethodId ?? ''} onChange={setShippingMethodId}>
                  <Stack gap="xs">
                    {shippingMethods.map((method) => (
                      <Radio
                        key={method.id}
                        value={method.id}
                        label={method.name}
                        description={`${method.description ? `${method.description} · ` : ''}حداقل زمان ارسال ${faNumber(method.minDeliveryDays)} روز · ${
                          method.isInvoiced
                            ? `هزینه ارسال ${faCurrency(method.minShippingCost, false)} در فاکتور محاسبه می‌شود`
                            : 'پس‌کرایه — هزینه ارسال هنگام تحویل گرفته می‌شود'
                        }`}
                      />
                    ))}
                  </Stack>
                </RadioGroup>
              )}
              <Group justify="space-between" mt="xs">
                <Button variant="subtle" onClick={() => setStep(0)}>
                  مرحله قبل
                </Button>
                <Button disabled={!shippingMethod} onClick={() => setStep(2)}>
                  ادامه
                </Button>
              </Group>
            </Stack>
          </Stepper.Step>

          <Stepper.Step
            label="پرداخت"
            description="پرداخت از کیف پول (شارژ آنلاین در صورت کسری)"
            icon={<IconCreditCard size={18} />}
            allowStepSelect={step > 2 && Boolean(addressId)}
          >
            <Stack gap="sm" mt="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  شماره سفارش
                </Text>
                <Text ff="monospace" size="sm" fw={600}>
                  {order.displayId}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  روش ارسال
                </Text>
                <Text size="sm" fw={600}>
                  {shippingMethod
                    ? `${shippingMethod.name} (حداقل ${faNumber(shippingMethod.minDeliveryDays)} روز)`
                    : '—'}
                </Text>
              </Group>
              <Group justify="space-between">
                <Group gap={6} wrap="nowrap">
                  <IconWallet size={16} />
                  <Text size="sm" c="dimmed">
                    موجودی کیف پول
                  </Text>
                </Group>
                <Text size="sm" fw={600}>
                  {faCurrency(walletBalance, false)}
                </Text>
              </Group>
              {coupon ? (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    تخفیف ({coupon.code})
                  </Text>
                  <Text size="sm" fw={700} c="green">
                    −{faCurrency(coupon.discount, false)}
                  </Text>
                </Group>
              ) : null}
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  مبلغ قابل پرداخت
                </Text>
                <Text size="sm" fw={800}>
                  {faCurrency(payable, false)}
                </Text>
              </Group>
              {shortfall > 0 ? (
                <Text size="xs" c="orange.7">
                  موجودی کیف پول کافی نیست؛ مبلغ {faCurrency(shortfall, false)} به‌صورت آنلاین شارژ
                  می‌شود و بلافاصله صرف پرداخت همین سفارش می‌شود.
                </Text>
              ) : (
                <Text size="xs" c="dimmed">
                  موجودی کیف پول شما این سفارش را پوشش می‌دهد و پرداخت بدون درگاه انجام می‌شود.
                </Text>
              )}
              {shortfall > 0 && gateways.length > 0 ? (
                <Stack gap={4}>
                  <Text size="xs" fw={600} c="dimmed">
                    درگاه پرداخت آنلاین
                  </Text>
                  <RadioGroup value={gateway} onChange={setGateway}>
                    <Stack gap={6}>
                      {gateways.map((option) => (
                        <Radio
                          key={option.id}
                          value={option.id}
                          label={
                            option.kind === 'bnpl'
                              ? `${option.label} (خرید اعتباری / اقساطی)`
                              : `${option.label} (پرداخت آنلاین)`
                          }
                          description={
                            option.kind === 'bnpl'
                              ? 'پرداخت اعتباری — مبلغ بعداً و طبق اقساط ارائه‌دهنده تسویه می‌شود'
                              : 'پرداخت مبلغ کسری با کارت بانکی'
                          }
                        />
                      ))}
                    </Stack>
                  </RadioGroup>
                </Stack>
              ) : null}
              <Group justify="space-between" mt="xs">
                <Button variant="subtle" onClick={() => setStep(1)}>
                  مرحله قبل
                </Button>
                <Button
                  size="md"
                  leftSection={<IconCreditCard size={18} />}
                  loading={paying}
                  onClick={handlePay}
                >
                  {shortfall > 0 ? 'پرداخت و شارژ آنلاین' : 'پرداخت از کیف پول'}
                </Button>
              </Group>

              {/* Payment-link share: let someone else view and pay this
                  invoice — the link SMS carries no login requirement. */}
              <Divider label="ارسال لینک پرداخت برای شخص دیگر" labelPosition="center" mt="sm" />
              <Group gap="xs" align="flex-end" wrap="nowrap">
                <PhoneInput
                  placeholder="شماره موبایل گیرنده"
                  style={{ flex: '1 1 160px' }}
                  value={linkMobile}
                  onChange={(event) => setLinkMobile(event.currentTarget.value)}
                  error={linkError ?? undefined}
                />
                <Button
                  variant="light"
                  leftSection={<IconSend size={16} />}
                  loading={sendingLink}
                  onClick={() => void handleSendPaymentLink()}
                >
                  ارسال لینک پرداخت
                </Button>
              </Group>
              <Text size="xs" c="dimmed">
                گیرنده بدون نیاز به ورود، فاکتور را می‌بیند و پرداخت می‌کند؛ امکان تغییر سفارش
                ندارد.
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                پس از پرداخت موفق، یک پیامک تأیید با اطلاعات فاکتور برای شما ارسال می‌شود.
              </Text>
            </Stack>
          </Stepper.Step>
        </Stepper>

        {error ? (
          <Alert
            variant="light"
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="خطا"
            mt="md"
          >
            {error}
          </Alert>
        ) : null}
      </Card>
    </Stack>
  );
}
