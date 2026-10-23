'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { IconBell, IconClockHour4, IconHeadset, IconMessageDots } from '@tabler/icons-react';
import { ActionIcon, Badge, Indicator, Menu, Tooltip } from '@mantine/core';
import { faNumber } from '@/lib/format';
import type { SupportTicketStats } from '@/lib/support';
import { TICKET_STATUS_LABELS } from '@/lib/support-status';

export interface NotificationsMenuProps {
  /** Counts rendered by the layout on the server — the client keeps them fresh. */
  initial: SupportTicketStats;
}

/**
 * The panel header's notification bell.
 *
 * It is a support-ticket inbox and nothing else: the badge is the number of
 * unread («جدید») tickets and the menu breaks that down into the two questions
 * a supporter actually asks — how much is new, and how much is still waiting
 * for an answer. Both rows are plain links into /support with the matching
 * filter already in the URL, so the filtered list is what opens — no clicking
 * a filter afterwards, and the result can be bookmarked.
 *
 * `initial` comes from the layout, so the first paint has the real count rather
 * than a zero the poll would have to correct.
 */
export default function NotificationsMenu({ initial }: NotificationsMenuProps) {
  const [stats, setStats] = useState<SupportTicketStats>(initial);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/support/counts');
    if (!response.ok) {
      // A failed poll keeps the last known count — a stale number is better
      // than a bell that silently reads zero.
      return;
    }
    const payload = (await response.json()) as Partial<SupportTicketStats>;
    setStats({ unread: Number(payload.unread) || 0, open: Number(payload.open) || 0 });
  }, []);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };

    const timer = window.setInterval(refreshIfVisible, 30_000);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [refresh]);

  const hasNews = stats.unread > 0 || stats.open > 0;

  return (
    <Menu position="bottom-end" withArrow shadow="md" width={280}>
      <Menu.Target>
        <Indicator
          disabled={stats.unread === 0}
          label={stats.unread > 9 ? '۹+' : faNumber(stats.unread)}
          size={18}
          color="red"
          withBorder
          offset={6}
        >
          <Tooltip label="اعلان‌ها">
            <ActionIcon variant="default" size="lg" radius="md" aria-label="اعلان‌ها">
              <IconBell size={19} />
            </ActionIcon>
          </Tooltip>
        </Indicator>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>اعلان‌ها</Menu.Label>

        {hasNews ? (
          <>
            <Menu.Item
              component={Link}
              href="/support?unread=1"
              leftSection={<IconMessageDots size={16} />}
              rightSection={
                <Badge size="sm" variant="filled" color="red" circle>
                  {faNumber(stats.unread)}
                </Badge>
              }
            >
              تیکت‌های جدید (خوانده‌نشده)
            </Menu.Item>
            <Menu.Item
              component={Link}
              href="/support?status=open"
              leftSection={<IconClockHour4 size={16} />}
              rightSection={
                <Badge size="sm" variant="light" color="orange" circle>
                  {faNumber(stats.open)}
                </Badge>
              }
            >
              {TICKET_STATUS_LABELS.open}
            </Menu.Item>
            <Menu.Divider />
          </>
        ) : (
          <Menu.Item disabled>اعلان تازه‌ای ندارید.</Menu.Item>
        )}

        <Menu.Item component={Link} href="/support" leftSection={<IconHeadset size={16} />}>
          مشاهدهٔ همهٔ تیکت‌ها
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
