import {
  IconBan,
  IconCircleCheck,
  IconCircleX,
  IconClipboardText,
  IconPackageImport,
  IconSend,
  IconWallet,
} from '@tabler/icons-react';
import { Text, Timeline, TimelineItem } from '@mantine/core';
import {
  RETURN_STATUS_COLORS,
  RETURN_TIMELINE_LABELS,
  type ReturnStatus,
} from '@/lib/return-status';

export interface ReturnTimelineEvent {
  toStatus: string;
  message: string;
  actorRole: string;
  createdAtLabel: string;
}

const STATUS_ICONS: Record<ReturnStatus, typeof IconClipboardText> = {
  requested: IconClipboardText,
  approved: IconCircleCheck,
  sent: IconSend,
  received: IconPackageImport,
  refunded: IconWallet,
  rejected: IconCircleX,
  cancelled: IconBan,
};

/**
 * تایم‌لاین عمودی مرجوعی — از ReturnEventها ساخته می‌شود و همان منبع برای
 * حساب مشتری و جزئیات پنل است؛ هر رویداد وضعیت، متن فارسی و ثبت‌کننده دارد.
 */
export default function ReturnTimeline({ events }: { events: ReturnTimelineEvent[] }) {
  return (
    <Timeline active={events.length} lineWidth={2} bulletSize={30}>
      {events.map((event, index) => {
        const status = (Object.keys(RETURN_TIMELINE_LABELS) as ReturnStatus[]).includes(
          event.toStatus as ReturnStatus
        )
          ? (event.toStatus as ReturnStatus)
          : 'requested';
        const Icon = STATUS_ICONS[status];
        return (
          <TimelineItem
            key={index}
            bullet={<Icon size={16} />}
            color={RETURN_STATUS_COLORS[status]}
            title={RETURN_TIMELINE_LABELS[status]}
          >
            <Text size="xs" c="dimmed">
              {event.message}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              {event.createdAtLabel} — {event.actorRole === 'staff' ? 'فروشگاه' : 'مشتری'}
            </Text>
          </TimelineItem>
        );
      })}
    </Timeline>
  );
}
