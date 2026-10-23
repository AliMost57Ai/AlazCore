/**
 * تست واژه‌نامه وضعیت و قاعده نخوانده مشتق — همان سناریوهای نسخه مرجع.
 */

import {
  isUnreadForSide,
  sideRoleOf,
  TICKET_STATUS_COLORS,
  TICKET_STATUS_LABELS,
  toTicketStatus,
} from './ticket-status';

/** تیکتی که آخرین پیامش از درخواست‌کننده است و پشتیبان هرگز بازش نکرده. */
const base = {
  lastMessageAt: new Date('2026-10-17T10:00:00.000Z'),
  lastMessageAuthor: 'customer',
  requesterReadAt: null,
  supporterReadAt: null,
};

describe('قاعده نخوانده مشتق', () => {
  it('پیام درخواست‌کننده برای پشتیبان نخوانده است', () => {
    expect(isUnreadForSide('supporter', base)).toBe(true);
  });

  it('پاسخ پشتیبان برای درخواست‌کننده نخوانده است', () => {
    expect(isUnreadForSide('requester', { ...base, lastMessageAuthor: 'owner' })).toBe(true);
  });

  it('سمتی که رشته را باز کرده دیگر نخوانده نمی‌بیند', () => {
    const read = new Date('2026-10-17T11:00:00.000Z');
    expect(isUnreadForSide('supporter', { ...base, supporterReadAt: read })).toBe(false);
    expect(
      isUnreadForSide('requester', { ...base, lastMessageAuthor: 'owner', requesterReadAt: read })
    ).toBe(false);
  });

  it('سمتی که آخرین پیام را خودش نوشته هرگز نخوانده نمی‌بیند', () => {
    expect(isUnreadForSide('supporter', { ...base, lastMessageAuthor: 'core' })).toBe(false);
    expect(isUnreadForSide('requester', base)).toBe(false);
  });

  it('readAt جدیدتر از پیام یعنی خوانده‌شده', () => {
    expect(
      isUnreadForSide('supporter', {
        ...base,
        supporterReadAt: new Date('2026-10-17T12:00:00.000Z'),
      })
    ).toBe(false);
  });

  it('رشته ISO هم مثل Date پذیرفته می‌شود (پرisma هر دو برمی‌گرداند)', () => {
    expect(
      isUnreadForSide('supporter', {
        ...base,
        lastMessageAt: '2026-10-17T10:00:00.000Z',
        supporterReadAt: '2026-10-17T09:00:00.000Z',
      })
    ).toBe(true);
  });

  it('سمت‌های خام هر دو جریان درست نگاشت می‌شوند', () => {
    expect(sideRoleOf('customer')).toBe('requester');
    expect(sideRoleOf('tenant')).toBe('requester');
    expect(sideRoleOf('owner')).toBe('supporter');
    expect(sideRoleOf('core')).toBe('supporter');
    expect(sideRoleOf('unknown')).toBe('requester');
  });
});

describe('واژه‌نامه وضعیت', () => {
  it('مقدار ناشناخته به open می‌خواند — pending نسخه‌های قدیمی هم open است', () => {
    expect(toTicketStatus('answered')).toBe('answered');
    expect(toTicketStatus('closed')).toBe('closed');
    expect(toTicketStatus('open')).toBe('open');
    expect(toTicketStatus('pending')).toBe('open');
    expect(toTicketStatus('weird')).toBe('open');
  });

  it('برچسب و رنگ هر سه وضعیت تعریف شده', () => {
    expect(TICKET_STATUS_LABELS.open).toBe('در انتظار پاسخ');
    expect(TICKET_STATUS_LABELS.answered).toBe('پاسخ داده شده');
    expect(TICKET_STATUS_LABELS.closed).toBe('بسته');
    expect(Object.keys(TICKET_STATUS_COLORS)).toEqual(['open', 'answered', 'closed']);
  });
});
