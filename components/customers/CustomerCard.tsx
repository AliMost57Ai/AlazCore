'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IconAlertCircle,
  IconBan,
  IconFileText,
  IconKey,
  IconLock,
  IconPhone,
  IconShoppingCart,
  IconUserPlus,
  IconWallet,
} from '@tabler/icons-react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  PasswordInput,
  Radio,
  RadioGroup,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import ResponsiveModal from '@/components/ui/panel/ResponsiveModal';
import type { Customer } from '@/lib/customers';
import { enCurrency, enNumber, fromFaDigits } from '@/lib/format';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/order-status';

const TIER_COLORS: Record<string, string> = {
  طلایی: 'yellow',
  نقره‌ای: 'gray',
  برنزی: 'orange',
};

export interface CustomerCardProps {
  customer: Customer;
  /** Write actions (wallet, block, password reset) only render for roles
   *  with the customers:edit grant — the API enforces it regardless. */
  canEdit: boolean;
}

/** The per-customer detail modal: recent orders and the active basket. */
function CustomerDetails({
  customer,
  opened,
  onClose,
}: {
  customer: Customer;
  opened: boolean;
  onClose: () => void;
}) {
  return (
    <ResponsiveModal opened={opened} onClose={onClose} title={`سفارش‌ها و سبد ${customer.name}`}>
      <Stack gap="md">
        <div>
          <Text size="sm" fw={600} mb="xs">
            سبد خرید فعال (سفارش پرداخت‌نشده)
          </Text>
          {customer.basket ? (
            <Card withBorder padding="sm">
              <Stack gap={6}>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="xs" c="dimmed" ff="monospace">
                    {customer.basket.displayId}
                  </Text>
                  <Text size="sm" fw={700}>
                    {enCurrency(customer.basket.amount)}
                  </Text>
                </Group>
                {customer.basket.items.map((item) => (
                  <Text key={`${customer.basket?.displayId}-${item.name}`} size="xs" c="dimmed">
                    {item.name} × {enNumber(item.qty)}
                  </Text>
                ))}
              </Stack>
            </Card>
          ) : (
            <Text size="sm" c="dimmed">
              این مشتری سفارش پرداخت‌نشده‌ای ندارد.
            </Text>
          )}
        </div>

        <Divider />

        <div>
          <Text size="sm" fw={600} mb="xs">
            سفارش‌های اخیر
          </Text>
          {customer.recentOrders.length === 0 ? (
            <Text size="sm" c="dimmed">
              هنوز سفارشی ثبت نکرده است.
            </Text>
          ) : (
            <Stack gap="xs">
              {customer.recentOrders.map((order) => (
                <Group key={order.displayId} justify="space-between" wrap="nowrap" gap="xs">
                  <Group gap="xs" wrap="nowrap">
                    <Badge
                      variant="light"
                      color={STATUS_COLORS[order.status]}
                      radius="sm"
                      size="sm"
                    >
                      {STATUS_LABELS[order.status]}
                    </Badge>
                    <Text size="xs" ff="monospace">
                      {order.displayId}
                    </Text>
                  </Group>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="xs" c="dimmed">
                      {order.date}
                    </Text>
                    <Text size="xs" fw={600}>
                      {enCurrency(order.amount)}
                    </Text>
                  </Group>
                </Group>
              ))}
            </Stack>
          )}

          {/* هر که این مودال را می‌بیند '/customers' دارد — پرونده هم برایش باز است. */}
          <Button
            fullWidth
            mt="sm"
            size="xs"
            variant="light"
            leftSection={<IconFileText size={14} />}
            component={Link}
            href={`/customers/${customer.id}`}
          >
            مشاهدهٔ پروندهٔ کامل مشتری
          </Button>
        </div>
      </Stack>
    </ResponsiveModal>
  );
}

/**
 * The admin's wallet adjustment modal: credit or debit the customer's wallet
 * with a mandatory reason (both land in the ledger as 'admin_adjust').
 */
function WalletAdjustModal({
  customer,
  opened,
  onClose,
}: {
  customer: Customer;
  opened: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [direction, setDirection] = useState<'+' | '-'>('+');
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const value =
      typeof amount === 'number'
        ? amount
        : Number(fromFaDigits(String(amount)).replace(/[٬,]/g, ''));
    if (!Number.isInteger(value) || value < 100) {
      setError('مبلغ باید حداقل ۱۰۰ تومان باشد.');
      return;
    }
    if (reason.trim().length < 3) {
      setError('دلیل تغییر موجودی را بنویسید (حداقل ۳ نویسه).');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/customers/${customer.id}/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction, amount: value, reason: reason.trim() }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        balance?: number;
        error?: string;
      };

      if (!response.ok || payload.balance === undefined) {
        setError(payload.error ?? 'ثبت تغییر ناموفق بود.');
        return;
      }

      notifications.show({
        title: 'کیف پول به‌روزرسانی شد',
        message: `موجودی جدید ${customer.name}: ${enCurrency(payload.balance, false)}`,
        color: 'green',
        icon: <IconWallet size={16} />,
      });
      onClose();
      setAmount('');
      setReason('');
      setDirection('+');
      // The card's balance and the wallet ledger changed server-side.
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveModal opened={opened} onClose={onClose} title={`کیف پول ${customer.name}`} size="sm">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            موجودی فعلی
          </Text>
          <Text size="sm" fw={800}>
            {enCurrency(customer.walletBalance, false)}
          </Text>
        </Group>

        <RadioGroup value={direction} onChange={(value) => setDirection(value === '-' ? '-' : '+')}>
          <Group gap="lg">
            <Radio value="+" label="افزایش موجودی" color="green" />
            <Radio value="-" label="کاهش موجودی" color="red" />
          </Group>
        </RadioGroup>

        <NumberInput
          label="مبلغ (تومان)"
          placeholder="مثلاً ۵۰۰۰۰۰"
          min={0}
          thousandSeparator=","
          hideControls
          value={amount}
          onChange={(value) => setAmount(typeof value === 'number' ? value : '')}
          dir="ltr"
        />

        <TextInput
          label="دلیل"
          placeholder="مثلاً جبران کالای معیوب"
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
        />

        {error ? (
          <Alert variant="light" color="red" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        ) : null}

        <Button
          fullWidth
          loading={saving}
          onClick={handleSubmit}
          color={direction === '+' ? 'green' : 'red'}
        >
          ثبت تغییر
        </Button>
      </Stack>
    </ResponsiveModal>
  );
}

/**
 * The admin's password-reset modal: types a new password for the customer
 * twice — no old password needed, the admin is resetting it on their behalf
 * (e.g. after a support call).
 */
function ResetPasswordModal({
  customer,
  opened,
  onClose,
}: {
  customer: Customer;
  opened: boolean;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setPassword('');
    setConfirm('');
    setError(null);
  }

  async function handleSubmit() {
    if (password.length < 8) {
      setError('گذرواژه باید حداقل ۸ نویسه باشد.');
      return;
    }
    if (password !== confirm) {
      setError('تکرار گذرواژه با گذرواژه یکسان نیست.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/customers/${customer.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'بازنشانی گذرواژه ناموفق بود.');
        return;
      }

      notifications.show({
        title: 'گذرواژه بازنشانی شد',
        message: `گذرواژه جدید برای ${customer.name} ثبت شد.`,
        color: 'green',
        icon: <IconKey size={16} />,
      });
      onClose();
      reset();
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveModal opened={opened} onClose={onClose} title={`بازنشانی گذرواژه ${customer.name}`}>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          گذرواژه جدید برای شماره {customer.phone} تعیین می‌شود؛ مشتری در ورود بعدی از همان استفاده
          می‌کند.
        </Text>

        <PasswordInput
          label="گذرواژه جدید"
          placeholder="حداقل ۸ نویسه"
          autoComplete="new-password"
          leftSection={<IconLock size={16} />}
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
        <PasswordInput
          label="تکرار گذرواژه جدید"
          placeholder="تکرار گذرواژه"
          autoComplete="new-password"
          leftSection={<IconLock size={16} />}
          value={confirm}
          onChange={(event) => setConfirm(event.currentTarget.value)}
        />

        {error ? (
          <Alert variant="light" color="red" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        ) : null}

        <Group justify="flex-end">
          <Button
            variant="default"
            size="xs"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            انصراف
          </Button>
          <Button size="xs" loading={saving} onClick={handleSubmit}>
            بازنشانی گذرواژه
          </Button>
        </Group>
      </Stack>
    </ResponsiveModal>
  );
}

/**
 * Client component on purpose: the action buttons embed tabler icon elements
 * in client-component props (`leftSection`), which cannot cross the
 * server/client boundary from a server page.
 */
export default function CustomerCard({ customer, canEdit }: CustomerCardProps) {
  const router = useRouter();
  const [detailsOpened, setDetailsOpened] = useState(false);
  const [walletOpened, setWalletOpened] = useState(false);
  const [blockOpened, setBlockOpened] = useState(false);
  const [resetOpened, setResetOpened] = useState(false);
  const [blocking, setBlocking] = useState(false);

  /** Blocks/unblocks via /api/admin/customers/[id]/block; the page refetches. */
  async function handleToggleBlock() {
    setBlocking(true);
    try {
      const response = await fetch(`/api/admin/customers/${customer.id}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: !customer.isBlocked }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        blocked?: boolean;
        error?: string;
      };

      if (!response.ok || payload.blocked === undefined) {
        notifications.show({
          title: 'خطا',
          message: payload.error ?? 'تغییر وضعیت مسدودی ناموفق بود.',
          color: 'red',
        });
        return;
      }

      notifications.show({
        title: payload.blocked ? 'مشتری مسدود شد' : 'مسدودی برداشته شد',
        message: customer.name,
        color: payload.blocked ? 'red' : 'green',
        icon: <IconBan size={16} />,
      });
      setBlockOpened(false);
      router.refresh();
    } catch {
      notifications.show({
        title: 'خطا',
        message: 'ارتباط با سرور برقرار نشد.',
        color: 'red',
      });
    } finally {
      setBlocking(false);
    }
  }

  return (
    <Card>
      <Group wrap="nowrap" gap="sm" align="flex-start">
        <Avatar color="brand" radius="xl" size={44}>
          {customer.initials}
        </Avatar>

        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Group gap="xs" wrap="nowrap" justify="space-between">
            <Text fw={600} truncate>
              {customer.name}
            </Text>
            <Group gap={4} wrap="nowrap">
              {customer.isBlocked ? (
                <Badge variant="light" color="red" radius="sm" size="sm">
                  مسدود
                </Badge>
              ) : null}
              <Badge
                variant="light"
                color={TIER_COLORS[customer.tier] ?? 'gray'}
                radius="sm"
                size="sm"
              >
                {customer.tier}
              </Badge>
            </Group>
          </Group>

          {/* Latin digits inside RTL text: force LTR so the number reads
              correctly. */}
          <Group gap={4} wrap="nowrap">
            <IconPhone size={13} />
            <Text size="xs" c="dimmed" dir="ltr" ta="start" truncate>
              {customer.phone}
            </Text>
          </Group>
        </Stack>
      </Group>

      <Group justify="space-between" mt="md" gap="xs">
        <Stack gap={0}>
          <Text size="xs" c="dimmed">
            سفارش‌ها
          </Text>
          <Text size="sm" fw={600}>
            {enNumber(customer.orders)}
          </Text>
        </Stack>
        <Stack gap={0} align="flex-end">
          <Text size="xs" c="dimmed">
            مجموع خرید
          </Text>
          <Text size="sm" fw={600}>
            {enCurrency(customer.spent)}
          </Text>
        </Stack>
        <Stack gap={0} align="flex-end">
          <Text size="xs" c="dimmed">
            کیف پول
          </Text>
          <Text size="sm" fw={600}>
            {enCurrency(customer.walletBalance, false)}
          </Text>
        </Stack>
        <Stack gap={0} align="flex-end">
          <Text size="xs" c="dimmed">
            عضویت
          </Text>
          <Text size="sm" fw={600}>
            {customer.since}
          </Text>
        </Stack>
      </Group>

      <Group gap="xs" mt="md" grow>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconShoppingCart size={14} />}
          onClick={() => setDetailsOpened(true)}
        >
          سفارش‌ها و سبد
        </Button>
        {canEdit ? (
          <Button
            variant="default"
            size="xs"
            leftSection={<IconWallet size={14} />}
            onClick={() => setWalletOpened(true)}
          >
            کیف پول
          </Button>
        ) : null}
        <Button
          variant="default"
          size="xs"
          leftSection={<IconPhone size={14} />}
          component="a"
          href={`tel:${customer.phone}`}
        >
          تماس
        </Button>
      </Group>

      {/* دارندگان کارت '/customers' دارند — پرونده هم برایشان باز است (مرجع). */}
      <Button
        fullWidth
        mt="xs"
        size="xs"
        variant="light"
        leftSection={<IconFileText size={14} />}
        component={Link}
        href={`/customers/${customer.id}`}
      >
        مشاهدهٔ پروندهٔ مشتری
      </Button>

      {canEdit ? (
        <>
          <Button
            fullWidth
            mt="xs"
            size="xs"
            variant="light"
            leftSection={<IconKey size={14} />}
            onClick={() => setResetOpened(true)}
          >
            بازنشانی رمز عبور
          </Button>

          <Button
            fullWidth
            mt="xs"
            size="xs"
            variant="light"
            color={customer.isBlocked ? 'green' : 'red'}
            leftSection={<IconBan size={14} />}
            onClick={() => setBlockOpened(true)}
          >
            {customer.isBlocked ? 'رفع مسدودی' : 'مسدود کردن مشتری'}
          </Button>
        </>
      ) : null}

      <ResponsiveModal
        opened={blockOpened}
        onClose={() => setBlockOpened(false)}
        title={customer.isBlocked ? 'رفع مسدودی' : 'مسدود کردن مشتری'}
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm">
            {customer.isBlocked
              ? `${customer.name} پس از رفع مسدودی می‌تواند دوباره وارد حسابش شود.`
              : `${customer.name} تا زمانی که مسدود است نمی‌تواند وارد حسابش شود.`}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" size="xs" onClick={() => setBlockOpened(false)}>
              انصراف
            </Button>
            <Button
              size="xs"
              color={customer.isBlocked ? 'green' : 'red'}
              loading={blocking}
              onClick={handleToggleBlock}
            >
              {customer.isBlocked ? 'رفع مسدودی' : 'مسدود کن'}
            </Button>
          </Group>
        </Stack>
      </ResponsiveModal>

      <CustomerDetails
        customer={customer}
        opened={detailsOpened}
        onClose={() => setDetailsOpened(false)}
      />

      <WalletAdjustModal
        customer={customer}
        opened={walletOpened}
        onClose={() => setWalletOpened(false)}
      />

      <ResetPasswordModal
        customer={customer}
        opened={resetOpened}
        onClose={() => setResetOpened(false)}
      />
    </Card>
  );
}

export function AddCustomerButton() {
  return (
    <Button leftSection={<IconUserPlus size={16} />} size="sm">
      افزودن مشتری
    </Button>
  );
}
