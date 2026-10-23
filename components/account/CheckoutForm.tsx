'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconAlertCircle,
  IconCalendarEvent,
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
  Box,
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
  /** 'courier' = ارسالی، 'pickup' = تحویل حضوری — وابسته به pickupLocationId. */
  kind: 'courier' | 'pickup';
  pickupLocationId: string | null;
  minDeliveryDays: number;
  minShippingCost: number;
  /** false = پس‌کرایه — the cost stays off the invoice. */
  isInvoiced: boolean;
}

/** نقطه تحویل حضوری فعال — بدون موقعیت هم ممکن است (lat/lng = null). */
export interface CheckoutPickupLocation {
  id: string;
  title: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

/** یک روز از پاسخ دسترس‌پذیری (/api/pickup/availability). */
interface PickupDayAvailability {
  date: string;
  dateLabel: string;
  isHoliday: boolean;
  isToday: boolean;
  slots: {
    id: string;
    label: string;
    capacity: number;
    reserved: number;
    remaining: number;
    isPast: boolean;
  }[];
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
  /** نقاط تحویل حضوری فعال (وقتی فیچر در Core خاموش باشد خالی است). */
  pickupLocations?: CheckoutPickupLocation[];
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

/** فاصله تقریبی دو نقطه جغرافیایی (کیلومتر) — برای «نزدیک شما». */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

/** برچسب کوتاه روز — «امروز»، «فردا»، بعدش «شنبه ۱۲ مهر». */
function dayButtonLabel(isoDate: string, isToday: boolean): string {
  if (isToday) {
    return 'امروز';
  }
  const date = new Date(`${isoDate}T00:00:00`);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sameDay =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();
  if (sameDay) {
    return 'فردا';
  }
  const weekday = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long' }).format(date);
  const dayMonth = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    day: 'numeric',
    month: 'long',
  }).format(date);
  return `${weekday} ${dayMonth}`;
}

/** The checkout state that survives a page refresh, per order. */
interface CheckoutDraft {
  step: number;
  addressId: string | null;
  shippingMethodId: string | null;
  gateway: string | null;
  coupon: { code: string; discount: number } | null;
  pickupLocationId: string | null;
  pickupDate: string | null;
  pickupSlotId: string | null;
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
 * then the stepper walks the customer through روش ارسال → آدرس/رزرو → پرداخت.
 *
 * Payment always runs through the wallet: with enough balance the order is
 * paid instantly, otherwise exactly the shortfall is charged online — through
 * one of the admin's active gateways (the default preselected) — and the
 * callback tops up the wallet and settles the order. Form-POST relay
 * gateways (Saman / Sepah / SizPay) are submitted through a hidden form.
 *
 * تحویل حضوری: با انتخاب روش pickup، پله دوم به‌جای آدرسِ مشتری، نقطه مراجعه
 * (با «نزدیک شما» وقتی لوکیشن روشن باشد)، روزهای هفته آینده و بازه‌های
 * زمانیِ با ظرفیت باقی‌مانده را نشان می‌دهد — آدرس و هزینه ارسال بی‌معناست.
 */
export default function CheckoutForm({
  order,
  walletBalance,
  gateways,
  defaultGateway,
  shippingMethods,
  pickupLocations = [],
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

  // تحویل حضوری — نقطه/روز/بازه انتخابی و دسترس‌پذیری واکشی‌شده.
  const [pickupLocationId, setPickupLocationId] = useState<string | null>(
    pickupLocations[0]?.id ?? null
  );
  const [pickupDate, setPickupDate] = useState<string | null>(null);
  const [pickupSlotId, setPickupSlotId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<PickupDayAvailability[] | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Payment-link share (ارسال لینک پرداخت): the mobile the customer wants to
  // hand the invoice to, and the send state.
  const [linkMobile, setLinkMobile] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const shippingMethod = shippingMethods.find((method) => method.id === shippingMethodId) ?? null;
  const isPickupMethod = shippingMethod?.kind === 'pickup';
  // تحویل حضوری هزینه ارسال ندارد — مراجعه حضوری است.
  const shippingCost =
    shippingMethod === null
      ? 0
      : isPickupMethod
        ? 0
        : shippingMethod.isInvoiced
          ? shippingMethod.minShippingCost
          : 0;

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
    if (
      draft.pickupLocationId &&
      pickupLocations.some((location) => location.id === draft.pickupLocationId)
    ) {
      setPickupLocationId(draft.pickupLocationId);
    }
    if (draft.pickupDate) {
      setPickupDate(draft.pickupDate);
    }
    if (draft.pickupSlotId) {
      setPickupSlotId(draft.pickupSlotId);
    }
    // Runs once per order — the picks live on in state afterwards.
  }, [order.id]);

  // Persist the flow so a refresh doesn't restart it from step one.
  useEffect(() => {
    writeDraft(order.id, {
      step,
      addressId,
      shippingMethodId,
      gateway,
      coupon,
      pickupLocationId,
      pickupDate,
      pickupSlotId,
    });
  }, [
    order.id,
    step,
    addressId,
    shippingMethodId,
    gateway,
    coupon,
    pickupLocationId,
    pickupDate,
    pickupSlotId,
  ]);

  // «نزدیک شما» — فقط با اجازه لوکیشن کاربر؛ ردشدن، بی‌سروصدا رد می‌شود.
  useEffect(() => {
    const hasCoords = pickupLocations.some(
      (location) => location.lat !== null && location.lng !== null
    );
    if (!hasCoords || userCoords || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => undefined,
      { timeout: 8000, maximumAge: 300_000 }
    );
    // یک بار در ورود به چک‌اوت کافی است.
  }, []);

  // واکشی دسترس‌پذیری نقطه انتخابی (۷ روز آینده با ظرفیت باقی‌مانده).
  useEffect(() => {
    if (!isPickupMethod || !pickupLocationId) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    setLoadingAvailability(true);
    setAvailabilityError(null);
    fetch(`/api/pickup/availability?locationId=${encodeURIComponent(pickupLocationId)}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          days?: PickupDayAvailability[];
          error?: string;
        };
        if (cancelled) {
          return;
        }
        if (!response.ok || !payload.days) {
          setAvailabilityError(payload.error ?? 'دریافت ظرفیت تحویل ناموفق بود.');
          setAvailability(null);
          return;
        }
        setAvailability(payload.days);
        // روز انتخابی که دیگر معتبر نیست (تعطیل/بیرون هفتاد) صفر می‌شود.
        setPickupDate((current) =>
          current && payload.days?.some((day) => day.date === current)
            ? current
            : (payload.days?.[0]?.date ?? null)
        );
      })
      .catch(() => {
        if (!cancelled) {
          setAvailabilityError('ارتباط با سرور برقرار نشد.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingAvailability(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isPickupMethod, pickupLocationId]);

  // انتخاب بازه که روز عوض می‌شود باید ریست شود.
  useEffect(() => {
    setPickupSlotId((current) => {
      const day = availability?.find((one) => one.date === pickupDate);
      return current &&
        day?.slots.some((slot) => slot.id === current && slot.remaining > 0 && !slot.isPast)
        ? current
        : null;
    });
  }, [availability, pickupDate]);

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

  /** اعتبارسنجی پله تحویل — بر اساس نوع روش ارسال انتخابی. */
  function validateDeliveryStep(): string | null {
    if (!shippingMethod) {
      return 'ابتدا یک روش ارسال انتخاب کنید.';
    }
    if (shippingMethod.kind === 'pickup') {
      if (!pickupLocationId) {
        return 'نقطه تحویل حضوری را انتخاب کنید.';
      }
      if (!pickupDate) {
        return 'روز تحویل را انتخاب کنید.';
      }
      if (!pickupSlotId) {
        return 'بازه زمانی تحویل را انتخاب کنید.';
      }
      return null;
    }
    return addressId ? null : 'ابتدا یک آدرس تحویل انتخاب کنید.';
  }

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
      setCouponError('ارتباط با سرور برقرار نشد.');
    } finally {
      setCheckingCoupon(false);
    }
  }

  async function handlePay() {
    const deliveryError = validateDeliveryStep();
    if (deliveryError) {
      setError(deliveryError);
      return;
    }

    setPaying(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${order.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressId: shippingMethod?.kind === 'pickup' ? undefined : addressId,
          couponCode: coupon?.code,
          gateway,
          shippingMethodId: shippingMethod?.id,
          ...(shippingMethod?.kind === 'pickup'
            ? {
                pickupLocationId,
                pickupDate,
                pickupSlotId,
              }
            : {}),
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
    const deliveryError = validateDeliveryStep();
    if (deliveryError) {
      setLinkError(deliveryError);
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
          addressId: shippingMethod?.kind === 'pickup' ? undefined : addressId,
          shippingMethodId: shippingMethod?.id,
          couponCode: coupon?.code,
          ...(shippingMethod?.kind === 'pickup'
            ? {
                pickupLocationId,
                pickupDate,
                pickupSlotId,
              }
            : {}),
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
      setLinkError('ارتباط با سرور برقرار نشد.');
    } finally {
      setSendingLink(false);
    }
  }

  const selectedPickupLocation = pickupLocations.find(
    (location) => location.id === pickupLocationId
  );
  const selectedDay = availability?.find((day) => day.date === pickupDate) ?? null;

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
                <Text
                  size="sm"
                  c={isPickupMethod || !shippingMethod.isInvoiced ? 'dimmed' : undefined}
                >
                  {isPickupMethod
                    ? 'تحویل حضوری — مراجعه به نقطه انتخابی'
                    : `هزینه ارسال (${shippingMethod.name})`}
                </Text>
              </Group>
              <Text
                size="sm"
                fw={600}
                c={isPickupMethod || !shippingMethod.isInvoiced ? 'dimmed' : undefined}
                style={{ whiteSpace: 'nowrap' }}
              >
                {isPickupMethod
                  ? 'بدون هزینه ارسال'
                  : shippingMethod.isInvoiced
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
          {/* پله ۱ — روش ارسال: courier (ارسالی) یا pickup (تحویل حضوری). */}
          <Stepper.Step
            label="روش ارسال"
            description="نحوه رسیدن سفارش به دست شما"
            icon={<IconTruck size={18} />}
            allowStepSelect={step > 0}
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
                        label={
                          method.kind === 'pickup' ? `${method.name} (تحویل حضوری)` : method.name
                        }
                        description={
                          method.kind === 'pickup'
                            ? `${method.description ? `${method.description} · ` : ''}بدون هزینه ارسال — رزرو روز و بازه مراجعه در پله بعد`
                            : `${method.description ? `${method.description} · ` : ''}حداقل زمان ارسال ${faNumber(method.minDeliveryDays)} روز · ${
                                method.isInvoiced
                                  ? `هزینه ارسال ${faCurrency(method.minShippingCost, false)} در فاکتور محاسبه می‌شود`
                                  : 'پس‌کرایه — هزینه ارسال هنگام تحویل گرفته می‌شود'
                              }`
                        }
                      />
                    ))}
                  </Stack>
                </RadioGroup>
              )}
              <Group justify="flex-end" mt="xs">
                <Button disabled={!shippingMethod} onClick={() => setStep(1)}>
                  مرحله بعد
                </Button>
              </Group>
            </Stack>
          </Stepper.Step>

          {/* پله ۲ — آدرس (ارسالی) یا نقطه/روز/بازه (تحویل حضوری). */}
          <Stepper.Step
            label={isPickupMethod ? 'نقطه و زمان تحویل' : 'آدرس تحویل'}
            description={
              isPickupMethod
                ? 'نقطه مراجعه و رزرو روز و ساعت تحویل'
                : 'نشانی ارسال سفارش را انتخاب کنید'
            }
            icon={<IconMapPin size={18} />}
            allowStepSelect={
              (step > 1 && !isPickupMethod && Boolean(addressId)) ||
              (step > 1 && isPickupMethod && Boolean(pickupLocationId))
            }
          >
            {isPickupMethod ? (
              <Stack gap="sm" mt="xs">
                {pickupLocations.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    نقطه تحویل حضوری فعالی وجود ندارد؛ با پشتیبانی تماس بگیرید.
                  </Text>
                ) : (
                  <>
                    <RadioGroup value={pickupLocationId ?? ''} onChange={setPickupLocationId}>
                      <Stack gap="xs">
                        {pickupLocations.map((location) => {
                          const nearby =
                            userCoords &&
                            location.lat !== null &&
                            location.lng !== null &&
                            haversineKm(userCoords, { lat: location.lat, lng: location.lng }) <= 10;
                          return (
                            <Radio
                              key={location.id}
                              value={location.id}
                              label={
                                <Group gap="xs" wrap="nowrap">
                                  <Text size="sm">{location.title}</Text>
                                  {nearby ? (
                                    <Badge variant="light" color="green" size="sm">
                                      نزدیک شما
                                    </Badge>
                                  ) : null}
                                </Group>
                              }
                              description={location.address}
                            />
                          );
                        })}
                      </Stack>
                    </RadioGroup>

                    <Divider label="روز و ساعت تحویل" labelPosition="center" />

                    {loadingAvailability ? (
                      <Text size="sm" c="dimmed">
                        در حال دریافت ظرفیت‌ها…
                      </Text>
                    ) : availabilityError ? (
                      <Text size="sm" c="red">
                        {availabilityError}
                      </Text>
                    ) : availability && availability.length > 0 ? (
                      <>
                        <Group gap={6} wrap="wrap">
                          {availability.map((day) => (
                            <Button
                              key={day.date}
                              size="compact-sm"
                              radius="md"
                              variant={pickupDate === day.date ? 'filled' : 'default'}
                              disabled={day.isHoliday}
                              onClick={() => setPickupDate(day.date)}
                            >
                              {dayButtonLabel(day.date, day.isToday)}
                            </Button>
                          ))}
                        </Group>

                        {selectedDay ? (
                          selectedDay.isHoliday ? (
                            <Text size="sm" c="dimmed">
                              این روز تعطیل است — روز دیگری را انتخاب کنید.
                            </Text>
                          ) : selectedDay.slots.length === 0 ? (
                            <Text size="sm" c="dimmed">
                              برای این روز بازه‌ای تعریف نشده است.
                            </Text>
                          ) : (
                            <Stack gap={4}>
                              {selectedDay.slots.map((slot) => {
                                const full = slot.remaining <= 0;
                                const disabled = full || slot.isPast;
                                return (
                                  <Box
                                    key={slot.id}
                                    component="button"
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => setPickupSlotId(slot.id)}
                                    style={{
                                      display: 'flex',
                                      width: '100%',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 8,
                                      padding: '8px 12px',
                                      borderRadius: 10,
                                      border: `1px solid ${
                                        pickupSlotId === slot.id
                                          ? 'var(--mantine-primary-color-filled)'
                                          : 'var(--mantine-color-default-border)'
                                      }`,
                                      background:
                                        pickupSlotId === slot.id
                                          ? 'var(--mantine-primary-color-light)'
                                          : 'transparent',
                                      cursor: disabled ? 'not-allowed' : 'pointer',
                                      opacity: disabled ? 0.55 : 1,
                                      textAlign: 'start',
                                    }}
                                  >
                                    <Text size="sm" fw={pickupSlotId === slot.id ? 600 : undefined}>
                                      {slot.label}
                                    </Text>
                                    <Text size="xs" c={full ? 'red' : 'dimmed'}>
                                      {slot.isPast
                                        ? 'گذشته'
                                        : full
                                          ? 'ظرفیت پر'
                                          : `${faNumber(slot.remaining)} ظرفیت آزاد`}
                                    </Text>
                                  </Box>
                                );
                              })}
                            </Stack>
                          )
                        ) : null}
                      </>
                    ) : null}
                  </>
                )}
              </Stack>
            ) : (
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
              </Stack>
            )}

            <Group justify="space-between" mt="xs">
              <Button variant="subtle" onClick={() => setStep(0)}>
                مرحله قبل
              </Button>
              <Button
                disabled={
                  isPickupMethod ? !pickupLocationId || !pickupDate || !pickupSlotId : !addressId
                }
                onClick={() => setStep(2)}
              >
                ادامه
              </Button>
            </Group>
          </Stepper.Step>

          {/* پله ۳ — پرداخت (بدون تغییر فرآیند). */}
          <Stepper.Step
            label="پرداخت"
            description="پرداخت از کیف پول (شارژ آنلاین در صورت کسری)"
            icon={<IconCreditCard size={18} />}
            allowStepSelect={Boolean(shippingMethod) && validateDeliveryStep() === null}
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
                  روش تحویل
                </Text>
                <Text size="sm" fw={600}>
                  {shippingMethod
                    ? isPickupMethod
                      ? `${shippingMethod.name}${selectedPickupLocation ? ` — ${selectedPickupLocation.title}` : ''}${selectedDay ? ` — ${selectedDay.dateLabel}` : ''}`
                      : `${shippingMethod.name} (حداقل ${faNumber(shippingMethod.minDeliveryDays)} روز)`
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

      {/* رزرو انتخابی مشتری — یادآوری ثابت زیر فرم (وقتی pickup انتخاب شده). */}
      {isPickupMethod && selectedPickupLocation && selectedDay && pickupSlotId ? (
        <Alert variant="light" color="brand" icon={<IconCalendarEvent size={18} />}>
          رزرو شما: {selectedPickupLocation.title} — {selectedDay.dateLabel}،{' '}
          {selectedDay.slots.find((slot) => slot.id === pickupSlotId)?.label ?? ''}
        </Alert>
      ) : null}
    </Stack>
  );
}
