import {
  DEFAULT_SUPPORT_WELCOME,
  DEFAULT_SUPPORT_WIDGET_CONFIG,
  isUnreadForCustomer,
  isUnreadForStaff,
  isWidgetAnimation,
  isWidgetPosition,
  resolveSupportWidgetConfig,
  toAuthorType,
  toTicketStatus,
  WIDGET_ANIMATIONS,
  WIDGET_POSITIONS,
} from './support-status';

/** A ticket whose newest message is from the requester, never opened by staff. */
const base = {
  lastMessageAt: new Date('2026-09-22T10:00:00.000Z'),
  lastMessageAuthor: 'customer' as const,
  staffReadAt: null,
  customerReadAt: null,
};

describe('unread rule', () => {
  it('counts a customer message as unread for staff', () => {
    expect(isUnreadForStaff(base)).toBe(true);
  });

  it('counts a supporter reply as unread for the customer', () => {
    expect(
      isUnreadForCustomer({
        ...base,
        lastMessageAuthor: 'staff',
      })
    ).toBe(true);
  });

  it('stops being unread for the side that already opened the thread', () => {
    const read = new Date('2026-09-22T11:00:00.000Z');
    expect(isUnreadForStaff({ ...base, staffReadAt: read })).toBe(false);
    expect(isUnreadForCustomer({ ...base, lastMessageAuthor: 'staff', customerReadAt: read })).toBe(
      false
    );
  });

  it('never marks the side that did not write last', () => {
    // Staff replied, so nothing is waiting for staff; the customer wrote, so
    // nothing is waiting for the customer.
    expect(isUnreadForStaff({ ...base, lastMessageAuthor: 'staff' })).toBe(false);
    expect(isUnreadForCustomer(base)).toBe(false);
  });

  it('treats a read timestamp newer than the message as read', () => {
    expect(isUnreadForStaff({ ...base, staffReadAt: new Date('2026-09-22T12:00:00.000Z') })).toBe(
      false
    );
  });

  it('accepts ISO strings as well as Dates (rows come back either way)', () => {
    expect(
      isUnreadForStaff({
        ...base,
        lastMessageAt: '2026-09-22T10:00:00.000Z',
        staffReadAt: '2026-09-22T09:00:00.000Z',
      })
    ).toBe(true);
  });
});

describe('stored values', () => {
  it('falls back to "open" for an unknown status', () => {
    expect(toTicketStatus('answered')).toBe('answered');
    expect(toTicketStatus('closed')).toBe('closed');
    expect(toTicketStatus('open')).toBe('open');
    expect(toTicketStatus('weird')).toBe('open');
  });

  it('treats every non-staff author as the requester', () => {
    expect(toAuthorType('staff')).toBe('staff');
    expect(toAuthorType('customer')).toBe('customer');
    expect(toAuthorType('')).toBe('customer');
  });

  it('ships a non-empty default welcome line', () => {
    expect(DEFAULT_SUPPORT_WELCOME.length).toBeGreaterThan(10);
  });
});

/** The stored widget settings, as getAppSettings hands them over. */
const widget = {
  supportWidgetPosition: 'top-right',
  supportWidgetAnimation: 'pop',
  supportWidgetDelay: '3',
  supportWidgetNoticeEnabled: false,
  supportWidgetNoticeSeconds: '5',
};

describe('widget settings', () => {
  it('recognises exactly the offered corners and animations', () => {
    expect(WIDGET_POSITIONS.every(isWidgetPosition)).toBe(true);
    expect(WIDGET_ANIMATIONS.every(isWidgetAnimation)).toBe(true);
    expect(isWidgetPosition('middle')).toBe(false);
    expect(isWidgetAnimation('bounce')).toBe(false);
  });

  it('resolves stored seconds into milliseconds', () => {
    expect(resolveSupportWidgetConfig(widget)).toEqual({
      position: 'top-right',
      animation: 'pop',
      delayMs: 3_000,
      noticeEnabled: false,
      noticeMs: 5_000,
    });
  });

  it('reads "0" as a real value, not as «unset»', () => {
    const config = resolveSupportWidgetConfig({
      ...widget,
      supportWidgetDelay: '0',
      supportWidgetNoticeSeconds: '0',
    });
    // 0 = no delay, and a notice that waits for the visitor to close it.
    expect(config.delayMs).toBe(0);
    expect(config.noticeMs).toBe(0);
  });

  it('falls back to the defaults for anything it does not recognise', () => {
    const config = resolveSupportWidgetConfig({
      supportWidgetPosition: 'bottom-middle',
      supportWidgetAnimation: '',
      supportWidgetDelay: 'soon',
      supportWidgetNoticeEnabled: true,
      supportWidgetNoticeSeconds: '1000',
    });
    expect(config.position).toBe(DEFAULT_SUPPORT_WIDGET_CONFIG.position);
    expect(config.animation).toBe(DEFAULT_SUPPORT_WIDGET_CONFIG.animation);
    expect(config.delayMs).toBe(0);
    expect(config.noticeMs).toBe(DEFAULT_SUPPORT_WIDGET_CONFIG.noticeMs);
  });

  it('accepts Persian digits and rejects a negative delay', () => {
    expect(resolveSupportWidgetConfig({ ...widget, supportWidgetDelay: '۱۲' }).delayMs).toBe(
      12_000
    );
    expect(resolveSupportWidgetConfig({ ...widget, supportWidgetDelay: '-1' }).delayMs).toBe(0);
  });

  it('never hides the widget by accident: every shipped default is usable', () => {
    expect(isWidgetPosition(DEFAULT_SUPPORT_WIDGET_CONFIG.position)).toBe(true);
    expect(isWidgetAnimation(DEFAULT_SUPPORT_WIDGET_CONFIG.animation)).toBe(true);
    expect(DEFAULT_SUPPORT_WIDGET_CONFIG.noticeEnabled).toBe(true);
    expect(DEFAULT_SUPPORT_WIDGET_CONFIG.noticeMs).toBeGreaterThan(0);
  });
});
