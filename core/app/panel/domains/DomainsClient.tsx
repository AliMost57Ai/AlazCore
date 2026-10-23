'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  IconCalendarPlus,
  IconCreditCard,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { faDate } from '@/lib/format';

export interface DomainRow {
  id: string;
  domain: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  techName: string;
  techPhone: string;
  techEmail: string;
  planId: string | null;
  planExpiresAt: string | null;
  isActive: boolean;
  status: string;
  notes: string;
  templateId: string | null;
  dbName: string | null;
  dbStatus: string | null;
  commissionPercent: number;
  oversellAllowed: boolean;
  oversellMax: number;
  inPersonDelivery: boolean;
  createdAt: string;
  plan: { id: string; name: string; durationDays: number | null } | null;
  template: { id: string; name: string } | null;
  gateways: { id: string; gateway: string; kind: string; isActive: boolean }[];
  smsPanels: { id: string; provider: string; isActive: boolean }[];
}

interface DomainsClientProps {
  domains: DomainRow[];
  plans: { id: string; name: string }[];
  templates: { id: string; name: string; key: string }[];
  /** حق فعال/غیرفعال کردن خالی‌فروشی و تعیین سقف آن (قابلیت نقش Core). */
  canOversell: boolean;
}

interface RenewState {
  row: DomainRow;
  mode: 'plan' | 'date';
  expiresAt: string;
}

export default function DomainsClient({
  domains,
  plans,
  templates,
  canOversell,
}: DomainsClientProps) {
  const [query, setQuery] = useState('');
  const [renew, setRenew] = useState<RenewState | null>(null);
  const [renewing, setRenewing] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return domains;
    }
    return domains.filter(
      (d) =>
        d.domain.includes(q) ||
        d.ownerName.toLowerCase().includes(q) ||
        (d.plan?.name ?? '').includes(q)
    );
  }, [domains, query]);

  /** تمدید: بر اساس مدت پلن یا تاریخ انتخابی کارشناس — سوابق ثبت می‌شود. */
  async function submitRenew() {
    if (!renew) {
      return;
    }
    setRenewing(true);
    try {
      const response = await fetch(`/api/domains/${renew.row.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          renew.mode === 'date' ? { mode: 'date', expiresAt: renew.expiresAt } : { mode: 'plan' }
        ),
      });
      const data = (await response.json()) as { error?: string; planExpiresAt?: string };
      if (!response.ok) {
        notifications.show({ message: data.error ?? 'تمدید ناموفق بود.', color: 'crimson' });
        return;
      }
      notifications.show({
        message: `اعتبار تا ${data.planExpiresAt ? new Date(data.planExpiresAt).toLocaleDateString('fa-IR-u-ca-persian') : ''} تمدید شد و دامنه فعال شد.`,
        color: 'brand',
      });
      setRenew(null);
      window.location.reload();
    } finally {
      setRenewing(false);
    }
  }

  /** تاریخ پیش‌فرض مودال تمدید: انقضای فعلی (یا امروز) — کارشناس می‌تواند عوض کند. */
  function openRenew(row: DomainRow) {
    const base = row.planExpiresAt ? new Date(row.planExpiresAt) : new Date();
    if (base.getTime() < Date.now()) {
      base.setTime(Date.now());
    }
    const planDays = row.plan?.durationDays ?? null;
    const suggested = planDays ? new Date(base.getTime() + planDays * 24 * 60 * 60 * 1000) : base;
    setRenew({
      row,
      mode: planDays ? 'plan' : 'date',
      expiresAt: suggested.toISOString().slice(0, 10),
    });
  }

  async function remove(row: DomainRow) {
    if (!window.confirm(`دامنه ${row.domain} و همه اتصالاتش حذف شود؟`)) {
      return;
    }
    const response = await fetch(`/api/domains/${row.id}`, { method: 'DELETE' });
    if (response.ok) {
      notifications.show({ message: 'دامنه حذف شد.', color: 'brand' });
      window.location.reload();
    } else {
      notifications.show({ message: 'حذف ناموفق بود.', color: 'crimson' });
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" wrap="nowrap">
        <Title order={2}>مدیریت دامین‌ها</Title>
        <Button
          radius="xl"
          leftSection={<IconPlus size={16} />}
          component={Link}
          href="/panel/domains/new"
        >
          تعریف دامنه جدید
        </Button>
      </Group>

      <Card padding="lg" withBorder>
        <Group justify="space-between" mb="md">
          <TextInput
            placeholder="جستجو در دامنه / مالک / پلن…"
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            w={320}
          />
          <Text size="sm" c="dimmed">
            {filtered.length.toLocaleString('en-US')} دامنه
          </Text>
        </Group>

        <ScrollArea>
          <Table highlightOnHover verticalSpacing="sm" style={{ minWidth: 900 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>دامنه</Table.Th>
                <Table.Th>مالک</Table.Th>
                <Table.Th>پلن</Table.Th>
                <Table.Th>اعتبار تا</Table.Th>
                <Table.Th>تم</Table.Th>
                <Table.Th>دیتابیس</Table.Th>
                <Table.Th>پورسانت</Table.Th>
                <Table.Th>وضعیت</Table.Th>
                <Table.Th>تاریخ ثبت</Table.Th>
                <Table.Th>عملیات</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((row) => {
                const expired = row.planExpiresAt
                  ? new Date(row.planExpiresAt) <= new Date()
                  : false;
                return (
                  <Table.Tr key={row.id}>
                    <Table.Td fw={600}>{row.domain}</Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm">{row.ownerName}</Text>
                        {row.ownerPhone ? (
                          <Text size="xs" c="dimmed" dir="ltr">
                            {row.ownerPhone}
                          </Text>
                        ) : null}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      {row.plan ? (
                        <Badge variant="light" color="blue">
                          {row.plan.name}
                        </Badge>
                      ) : (
                        <Badge variant="light" color="gray">
                          بدون پلن
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>{row.planExpiresAt ? faDate(row.planExpiresAt) : 'نامحدود'}</Table.Td>
                    <Table.Td>{row.template?.name ?? 'پیش‌فرض'}</Table.Td>
                    <Table.Td>
                      {new Intl.NumberFormat('en-US').format(row.commissionPercent ?? 0)}٪
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text
                          size="xs"
                          dir="ltr"
                          ta="right"
                          c={row.dbStatus === 'ready' ? undefined : 'orange'}
                        >
                          {row.dbName ?? '—'}
                        </Text>
                        {row.dbStatus && row.dbStatus !== 'ready' ? (
                          <Text size="xs" c="orange">
                            در انتظار provision
                          </Text>
                        ) : null}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={
                          !row.isActive || row.status !== 'active'
                            ? 'crimson'
                            : expired
                              ? 'orange'
                              : 'green'
                        }
                      >
                        {!row.isActive
                          ? 'غیرفعال'
                          : row.status === 'suspended'
                            ? 'معلق'
                            : expired
                              ? 'منقضی'
                              : 'فعال'}
                      </Badge>
                    </Table.Td>
                    <Table.Td c="dimmed">{faDate(row.createdAt)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="درگاه‌ها و پنل پیامکی">
                          <ActionIcon
                            component={Link}
                            href={`/panel/domains/${row.id}/integrations`}
                            variant="subtle"
                            color="brand"
                          >
                            <IconCreditCard size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="تمدید اعتبار">
                          <ActionIcon variant="subtle" color="green" onClick={() => openRenew(row)}>
                            <IconCalendarPlus size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="ویرایش">
                          <ActionIcon
                            component={Link}
                            href={`/panel/domains/${row.id}/edit`}
                            variant="subtle"
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="حذف">
                          <ActionIcon variant="subtle" color="crimson" onClick={() => remove(row)}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={10} ta="center" c="dimmed" py="xl">
                    دامنه‌ای یافت نشد.
                  </Table.Td>
                </Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      {/* تمدید اعتبار — بر اساس مدت پلن یا تاریخ انتخاب کارشناس */}
      <Modal
        opened={renew !== null}
        onClose={() => setRenew(null)}
        title={renew ? `تمدید اعتبار ${renew.row.domain}` : 'تمدید اعتبار'}
        centered
        size="sm"
      >
        {renew ? (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              اعتبار فعلی: {renew.row.planExpiresAt ? faDate(renew.row.planExpiresAt) : 'نامحدود'}
              {renew.row.plan ? ` — پلن ${renew.row.plan.name}` : ' — بدون پلن'}
            </Text>
            <Switch
              label="تمدید بر اساس مدت پلن"
              description={
                renew.row.plan?.durationDays
                  ? `به اندازه ${renew.row.plan.durationDays.toLocaleString('en-US')} روز به انقضای فعلی اضافه می‌شود`
                  : 'این پلن مدت اعتبار ندارد — تاریخ دستی انتخاب کنید'
              }
              checked={renew.mode === 'plan'}
              disabled={!renew.row.plan?.durationDays}
              onChange={(e) =>
                setRenew({ ...renew, mode: e.currentTarget.checked ? 'plan' : 'date' })
              }
            />
            <TextInput
              label="یا تمدید تا تاریخ (yyyy-mm-dd)"
              type="date"
              disabled={renew.mode !== 'date'}
              value={renew.expiresAt}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) =>
                setRenew({ ...renew, mode: 'date', expiresAt: e.currentTarget.value })
              }
            />
            <Text size="xs" c="dimmed">
              با تمدید، دامنه از حالت غیرفعال/تعلیق خارج می‌شود و ردیف سابقه ثبت می‌گردد.
            </Text>
            <Group justify="end" mt="xs">
              <Button variant="subtle" onClick={() => setRenew(null)}>
                انصراف
              </Button>
              <Button
                loading={renewing}
                onClick={submitRenew}
                leftSection={<IconCalendarPlus size={16} />}
              >
                ثبت تمدید
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}
