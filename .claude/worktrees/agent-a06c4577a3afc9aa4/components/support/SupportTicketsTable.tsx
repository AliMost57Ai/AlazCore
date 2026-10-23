'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconSearch } from '@tabler/icons-react';
import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { faNumber } from '@/lib/format';
import type { SupportTicketDTO } from '@/lib/support';
import { TICKET_STATUS_COLORS, TICKET_STATUS_LABELS } from '@/lib/support-status';

export interface SupportTicketsTableProps {
  tickets: SupportTicketDTO[];
  page: number;
  hasMore: boolean;
  /** Current filter values, read from the URL by the page. */
  filters: { status: string; unread: boolean; q: string };
  /** Total tickets on record — shown in the header line. */
  total: number;
}

/** Ticket statuses offered in the filter control. */
const STATUS_OPTIONS = [
  { value: 'all', label: 'همه' },
  { value: 'open', label: TICKET_STATUS_LABELS.open },
  { value: 'answered', label: TICKET_STATUS_LABELS.answered },
  { value: 'closed', label: TICKET_STATUS_LABELS.closed },
];

/**
 * The supporter's ticket list. Filters and paging live in the URL (a native
 * form GET plus links), so the page stays a server component and a filtered
 * list can be bookmarked or shared.
 */
export default function SupportTicketsTable({
  tickets,
  page,
  hasMore,
  filters,
  total,
}: SupportTicketsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /** Rebuilds the query string with one filter changed, dropping empty keys. */
  function hrefWith(changes: Record<string, string | null>): string {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    // Any filter change resets paging — page 3 of the old filter is meaningless.
    if (!('page' in changes)) {
      next.delete('page');
    }
    const query = next.toString();
    return query ? `/support?${query}` : '/support';
  }

  return (
    <Stack gap="md">
      <Card>
        <form method="get" action="/support">
          <Stack gap="sm">
            <Group gap="sm" wrap="wrap">
              <TextInput
                name="q"
                defaultValue={filters.q}
                placeholder="جستجوی شماره تیکت، موضوع، نام یا موبایل…"
                size="sm"
                radius="md"
                aria-label="جستجوی تیکت"
                leftSection={<IconSearch size={16} />}
                style={{ flex: '1 1 260px' }}
              />
              <Button type="submit" variant="default" size="sm" radius="md">
                جستجو
              </Button>
            </Group>

            {/* Status filter — a plain GET control so it needs no JS state. */}
            <input type="hidden" name="status" value={filters.status} />
            <input type="hidden" name="unread" value={filters.unread ? '1' : ''} />
            <Group gap="md" wrap="wrap">
              <SegmentedControl
                size="xs"
                value={filters.status}
                data={STATUS_OPTIONS}
                onChange={(value) => router.push(hrefWith({ status: value }))}
              />
              <Switch
                size="sm"
                label="فقط خوانده‌نشده‌ها"
                checked={filters.unread}
                onChange={(event) =>
                  router.push(hrefWith({ unread: event.currentTarget.checked ? '1' : null }))
                }
              />
            </Group>
          </Stack>
        </form>
      </Card>

      <Card withBorder padding={0}>
        <Group justify="space-between" p="md">
          <Text size="sm" fw={600}>
            تیکت‌های پشتیبانی
          </Text>
          <Text size="xs" c="dimmed">
            {faNumber(total)} تیکت ثبت‌شده
          </Text>
        </Group>

        {tickets.length === 0 ? (
          <Text size="sm" c="dimmed" py="xl" ta="center">
            تیکتی با این فیلترها یافت نشد.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={880}>
            <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>شماره</Table.Th>
                  <Table.Th>درخواست‌کننده</Table.Th>
                  <Table.Th>موضوع</Table.Th>
                  <Table.Th>وضعیت</Table.Th>
                  <Table.Th>آخرین پیام</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tickets.map((ticket) => (
                  <Table.Tr key={ticket.id}>
                    <Table.Td>
                      <Text size="sm" ff="monospace">
                        {ticket.displayId}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Text size="sm">{ticket.requesterName}</Text>
                        {ticket.isGuest ? (
                          <Badge size="xs" variant="light" color="grape">
                            مهمان
                          </Badge>
                        ) : null}
                      </Group>
                      {ticket.requesterPhone ? (
                        <Text size="xs" c="dimmed" dir="ltr">
                          {ticket.requesterPhone}
                        </Text>
                      ) : null}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1} maw={260}>
                        {ticket.subject}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={TICKET_STATUS_COLORS[ticket.status]}>
                        {TICKET_STATUS_LABELS[ticket.status]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" lineClamp={1} maw={280}>
                        {ticket.lastMessageAuthor === 'staff' ? 'پشتیبان: ' : ''}
                        {ticket.lastMessage}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {ticket.lastMessageDate}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        {ticket.unread ? (
                          <Badge size="xs" color="red" variant="filled">
                            خوانده‌نشده
                          </Badge>
                        ) : null}
                        <UnstyledButton component={Link} href={`/support/${ticket.id}`}>
                          <Anchor component="span" size="sm" c="brand">
                            مشاهده گفتگو
                          </Anchor>
                        </UnstyledButton>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}

        {page > 1 || hasMore ? (
          <Group justify="center" gap="sm" p="md">
            {page > 1 ? (
              <Button
                component={Link}
                href={hrefWith({ page: page - 1 === 1 ? null : String(page - 1) })}
                variant="default"
                size="xs"
              >
                صفحه قبل
              </Button>
            ) : null}
            <Text size="sm" c="dimmed">
              صفحه {faNumber(page)}
            </Text>
            {hasMore ? (
              <Button
                component={Link}
                href={hrefWith({ page: String(page + 1) })}
                variant="default"
                size="xs"
              >
                صفحه بعد
              </Button>
            ) : null}
          </Group>
        ) : null}
      </Card>
    </Stack>
  );
}
