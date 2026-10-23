'use client';

import { useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';

interface GatewayCatalogRow {
  id: string;
  kind: string;
  label: string;
  isActive: boolean;
}

interface SmsCatalogRow {
  id: string;
  label: string;
  isActive: boolean;
}

/**
 * تخصیص درگاه/پیامک به یک دامین — صفحه tabular. تیک‌ها local نگه داشته
 * می‌شوند و «ذخیره تغییرات» diff را اعمال می‌کند (upsert تیک‌خورده‌ها، حذف
 * برداشته‌شده‌ها). آیتم غیرفعالِ کاتالوگ در فهرست تخصیص نمی‌آید؛ تخصیص
 * قدیمیِ آن‌ها در بخش جدا و همچنان فعال نمایش داده می‌شود.
 */
export default function IntegrationsClient({
  domainId,
  domainName,
  gateways,
  smsPanels,
  assignedGateways,
  assignedSms,
}: {
  domainId: string;
  domainName: string;
  gateways: GatewayCatalogRow[];
  smsPanels: SmsCatalogRow[];
  assignedGateways: Record<string, boolean>;
  assignedSms: Record<string, boolean>;
}) {
  const [gatewayState, setGatewayState] = useState<Record<string, boolean>>(assignedGateways);
  const [smsState, setSmsState] = useState<Record<string, boolean>>(assignedSms);
  const [saving, setSaving] = useState(false);

  const gatewayById = useMemo(() => new Map(gateways.map((g) => [g.id, g])), [gateways]);
  const smsById = useMemo(() => new Map(smsPanels.map((p) => [p.id, p])), [smsPanels]);

  const ipgList = gateways.filter((g) => g.kind === 'ipg' && g.isActive);
  const bnplList = gateways.filter((g) => g.kind === 'bnpl' && g.isActive);
  // تخصیص‌های قدیمی که آیتم کاتالوگشان حالا غیرفعال است — جدا نمایش داده
  // می‌شوند و همچنان فعال می‌مانند (قاعده‌ی کاربر).
  const legacyGateways = Object.keys(assignedGateways).filter((id) => {
    const entry = gatewayById.get(id);
    return !entry || !entry.isActive;
  });
  const legacySms = Object.keys(assignedSms).filter((id) => {
    const entry = smsById.get(id);
    return !entry || !entry.isActive;
  });

  const changed =
    JSON.stringify(gatewayState) !== JSON.stringify(assignedGateways) ||
    JSON.stringify(smsState) !== JSON.stringify(assignedSms);

  function toggle(state: Record<string, boolean>, set: (v: Record<string, boolean>) => void, id: string, checked: boolean) {
    set({ ...state, [id]: checked });
  }

  async function save() {
    setSaving(true);
    try {
      // حذف: قبلی بود ولی الان تیک ندارد (و در کاتالوگ فعال است).
      // قاعده «در حال استفاده»: حذف موردِ استفاده‌شده توسط مالک 409 می‌گیرد
      // و در پیام جدا گزارش می‌شود؛ بقیه تغییرات اعمال می‌شوند.
      const refused: string[] = [];
      for (const id of Object.keys(assignedGateways)) {
        if (!gatewayState[id] && gatewayById.get(id)?.isActive) {
          const response = await fetch(
            `/api/domains/${domainId}/gateways?gateway=${encodeURIComponent(id)}`,
            { method: 'DELETE' }
          );
          if (!response.ok) {
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            refused.push(data.error ?? `درگاه ${id}`);
          }
        }
      }
      for (const id of Object.keys(assignedSms)) {
        if (!smsState[id] && smsById.get(id)?.isActive) {
          const response = await fetch(
            `/api/domains/${domainId}/sms?provider=${encodeURIComponent(id)}`,
            { method: 'DELETE' }
          );
          if (!response.ok) {
            const data = (await response.json().catch(() => ({}))) as { error?: string };
            refused.push(data.error ?? `پنل پیامکی ${id}`);
          }
        }
      }
      if (refused.length > 0) {
        notifications.show({
          title: 'برخی حذف‌ها اعمال نشد',
          message: refused.join(' — '),
          color: 'orange',
          autoClose: 8000,
        });
      }
      // افزودن/به‌روزرسانی تیک‌خورده‌ها.
      for (const [id, active] of Object.entries(gatewayState)) {
        if (active && gatewayById.get(id)?.isActive) {
          const entry = gatewayById.get(id)!;
          await fetch(`/api/domains/${domainId}/gateways`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gateway: id, kind: entry.kind, isActive: true }),
          });
        }
      }
      for (const [id, active] of Object.entries(smsState)) {
        if (active && smsById.get(id)?.isActive) {
          await fetch(`/api/domains/${domainId}/sms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: id, isActive: true }),
          });
        }
      }
      notifications.show({ message: 'تخصیص‌ها ذخیره شد.', color: 'brand' });
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  function renderTable(
    rows: { id: string; label: string }[],
    state: Record<string, boolean>,
    set: (v: Record<string, boolean>) => void
  ) {
    return (
      <ScrollArea>
        <Table highlightOnHover verticalSpacing="sm" style={{ minWidth: 560 }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>تخصیص</Table.Th>
              <Table.Th>نام</Table.Th>
              <Table.Th>شناسه</Table.Th>
              <Table.Th>وضعیت تخصیص</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td w={90}>
                  <Checkbox
                    aria-label={`تخصیص ${row.label}`}
                    checked={state[row.id] === true}
                    onChange={(e) => toggle(state, set, row.id, e.currentTarget.checked)}
                  />
                </Table.Td>
                <Table.Td fw={600}>{row.label}</Table.Td>
                <Table.Td dir="ltr" ta="right" c="dimmed">
                  {row.id}
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" variant="light" color={state[row.id] ? 'green' : 'gray'}>
                    {state[row.id] ? 'تخصیص‌یافته' : '—'}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4} ta="center" c="dimmed" py="sm">
                  آیتم فعالی در کاتالوگ نیست.
                </Table.Td>
              </Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" wrap="nowrap">
        <Title order={2}>
          درگاه‌ها و پنل‌های پیامکی{' '}
          <Text component="span" dir="ltr" size="h3" c="dimmed">
            {domainName}
          </Text>
        </Title>
        <Button loading={saving} disabled={!changed} onClick={save}>
          ذخیره تغییرات
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        فقط موارد تخصیص‌یافته در اعتبارسنجی لایسنس این سایت برمی‌گردند و در پنل ادمین مالک دیده
        می‌شوند. غیرفعال‌کردن یک آیتم در کاتالوگ، آن را فقط از این فهرست تخصیص حذف می‌کند.
      </Text>

      <Card padding="lg" withBorder>
        <Text fw={700} mb="sm">
          درگاه‌های پرداخت آنلاین
        </Text>
        {renderTable(ipgList, gatewayState, setGatewayState)}
      </Card>

      <Card padding="lg" withBorder>
        <Text fw={700} mb="sm">
          درگاه‌های اقساطی
        </Text>
        {renderTable(bnplList, gatewayState, setGatewayState)}
      </Card>

      <Card padding="lg" withBorder>
        <Text fw={700} mb="sm">
          پنل‌های پیامکی
        </Text>
        {renderTable(smsPanels.filter((p) => p.isActive), smsState, setSmsState)}
      </Card>

      {legacyGateways.length > 0 || legacySms.length > 0 ? (
        <Card padding="lg" withBorder>
          <Text fw={700} mb="xs">
            تخصیص‌های قدیمی (کاتالوگ غیرفعال)
          </Text>
          <Text size="xs" c="dimmed" mb="sm">
            این موارد قبلاً تخصیص یافته‌اند و آیتم‌شان در کاتالوگ غیرفعال شده — سایت همچنان از
            آن‌ها استفاده می‌کند. با حذف از فهرست زیر می‌توانید لغوشان کنید.
          </Text>
          <Stack gap="xs">
            {legacyGateways.map((id) => (
              <Box key={`g-${id}`} style={{ opacity: 0.7 }}>
                <Checkbox
                  label={
                    <Group gap={6}>
                      <span>{gatewayById.get(id)?.label ?? id}</span>
                      <Badge size="xs" variant="light" color="gray">
                        درگاه — کاتالوگ غیرفعال
                      </Badge>
                    </Group>
                  }
                  checked={gatewayState[id] === true}
                  onChange={(e) =>
                    setGatewayState({ ...gatewayState, [id]: e.currentTarget.checked })
                  }
                />
              </Box>
            ))}
            {legacySms.map((id) => (
              <Box key={`s-${id}`} style={{ opacity: 0.7 }}>
                <Checkbox
                  label={
                    <Group gap={6}>
                      <span>{smsById.get(id)?.label ?? id}</span>
                      <Badge size="xs" variant="light" color="gray">
                        پنل پیامکی — کاتالوگ غیرفعال
                      </Badge>
                    </Group>
                  }
                  checked={smsState[id] === true}
                  onChange={(e) => setSmsState({ ...smsState, [id]: e.currentTarget.checked })}
                />
              </Box>
            ))}
          </Stack>
          {changed ? (
            <Text size="xs" c="orange" mt="sm">
              تغییرات ذخیره‌نشده دارید — دکمه «ذخیره تغییرات» را بزنید.
            </Text>
          ) : null}
        </Card>
      ) : null}
    </Stack>
  );
}
