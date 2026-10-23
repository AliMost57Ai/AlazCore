/**
 * Support-ticket vocabulary — statuses, labels and the unread rule.
 *
 * Deliberately free of Prisma and React (compare lib/order-status.ts), so the
 * storefront chat widget, the panel tables and the server modules all share
 * one definition of what «خوانده‌نشده» means.
 *
 * Unread is *derived*, never counted: a ticket carries the timestamp of its
 * last message plus the last time each side opened it, so the boolean cannot
 * drift away from the actual thread the way an integer counter can.
 */

import { fromFaDigits } from './format';

/** 'open' (در انتظار پاسخ) | 'answered' | 'closed' */
export type SupportTicketStatus = 'open' | 'answered' | 'closed';

/** Which side wrote a message — the requester or the supporter. */
export type SupportAuthorType = 'customer' | 'staff';

/** Persian labels for the ticket status badge. */
export const TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'در انتظار پاسخ',
  answered: 'پاسخ داده شده',
  closed: 'بسته شده',
};

/** Mantine badge colors matching the labels above. */
export const TICKET_STATUS_COLORS: Record<SupportTicketStatus, string> = {
  open: 'orange',
  answered: 'teal',
  closed: 'gray',
};

/** Anything stored in SupportTicket.status reads back as a known status. */
export function toTicketStatus(value: string): SupportTicketStatus {
  return value === 'answered' || value === 'closed' ? value : 'open';
}

/** Anything stored in SupportMessage.authorType reads back as a known side. */
export function toAuthorType(value: string): SupportAuthorType {
  return value === 'staff' ? 'staff' : 'customer';
}

/** The welcome line the chat drawer opens with, when the admin left it empty. */
export const DEFAULT_SUPPORT_WELCOME =
  'سلام! چطور می‌توانیم کمکتان کنیم؟ پیامتان را بنویسید تا در اولین فرصت پاسخ دهیم.';

/** The minimum a ticket must expose for the unread rule below. */
export interface UnreadFacts {
  /** Timestamp of the newest message in the thread. */
  lastMessageAt: Date | string;
  /** Which side wrote that newest message. */
  lastMessageAuthor: SupportAuthorType;
  /** When the supporter last opened the thread (null = never). */
  staffReadAt: Date | string | null;
  /** When the requester last opened the thread (null = never). */
  customerReadAt: Date | string | null;
}

/** Milliseconds for a Date, an ISO string or a Prisma DateTime alike. */
function time(value: Date | string | null): number {
  if (value === null) {
    return 0;
  }
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * True when the supporter still has something to read: the newest message came
 * from the requester and was written after the last time staff opened it.
 * A ticket never opened by staff (staffReadAt = null) counts as unread.
 */
export function isUnreadForStaff(facts: UnreadFacts): boolean {
  if (facts.lastMessageAuthor !== 'customer') {
    return false;
  }
  return time(facts.lastMessageAt) > time(facts.staffReadAt);
}

/**
 * True when the requester has an answer they have not seen yet: the newest
 * message came from the supporter and was written after the requester's last
 * visit. Drives the unread bubble on the storefront chat button.
 */
export function isUnreadForCustomer(facts: UnreadFacts): boolean {
  if (facts.lastMessageAuthor !== 'staff') {
    return false;
  }
  return time(facts.lastMessageAt) > time(facts.customerReadAt);
}

/* ---------------------------------------------------------------------------
 * Storefront widget presentation (تنظیمات ← پشتیبانی).
 *
 * The admin chooses where the floating button sits, how it arrives and whether
 * the greeting bubble shows; the widget renders only what these resolve to.
 *
 * Every value here is a plain string in the DB — FIELD_SPECS has no numeric
 * kind (compare vibeInstallments) — so the resolver is the one place that turns
 * stored text into typed values, and an unknown or hand-edited row reads as the
 * default instead of breaking the widget.
 * ------------------------------------------------------------------------ */

/** The four screen corners the button may be anchored to. */
export const WIDGET_POSITIONS = ['bottom-left', 'bottom-right', 'top-left', 'top-right'] as const;

export type SupportWidgetPosition = (typeof WIDGET_POSITIONS)[number];

/** Persian labels for the admin select — and for anything else naming a corner. */
export const WIDGET_POSITION_LABELS: Record<SupportWidgetPosition, string> = {
  'bottom-left': 'پایین-چپ',
  'bottom-right': 'پایین-راست',
  'top-left': 'بالا-چپ',
  'top-right': 'بالا-راست',
};

/** How the button arrives on the page. */
export const WIDGET_ANIMATIONS = ['none', 'fade', 'scale', 'slide', 'pop'] as const;

export type SupportWidgetAnimation = (typeof WIDGET_ANIMATIONS)[number];

export const WIDGET_ANIMATION_LABELS: Record<SupportWidgetAnimation, string> = {
  none: 'بدون انیمیشن (نمایش یک‌باره)',
  fade: 'محو شدن',
  scale: 'بزرگ شدن',
  slide: 'سریدن از لبه',
  pop: 'پاپ از گوشه',
};

/** The five stored settings the widget reads, exactly as getAppSettings returns them. */
export interface SupportWidgetSettings {
  supportWidgetPosition: string;
  supportWidgetAnimation: string;
  /** Seconds to wait after page load before the button appears. */
  supportWidgetDelay: string;
  supportWidgetNoticeEnabled: boolean;
  /** Seconds the greeting bubble stays before closing itself. */
  supportWidgetNoticeSeconds: string;
}

/** What the widget renders — resolved, typed, in milliseconds. */
export interface SupportWidgetConfig {
  position: SupportWidgetPosition;
  animation: SupportWidgetAnimation;
  /** Wait after page load. 0 = the button is there from the first paint. */
  delayMs: number;
  /** Whether the greeting bubble is shown at all. */
  noticeEnabled: boolean;
  /** How long the bubble stays. 0 = it waits for the visitor to close it. */
  noticeMs: number;
}

/** Seconds are stored the way the admin API validates them: at most three digits. */
const MAX_WIDGET_SECONDS = 999;

/** The built-in state of a shop that never opened این تنظیمات. */
export const DEFAULT_SUPPORT_WIDGET_CONFIG: SupportWidgetConfig = {
  position: 'bottom-left',
  animation: 'fade',
  delayMs: 0,
  noticeEnabled: true,
  noticeMs: 8_000,
};

/** Whether a stored string names a real corner (used by the admin API too). */
export function isWidgetPosition(value: string): value is SupportWidgetPosition {
  return (WIDGET_POSITIONS as readonly string[]).includes(value);
}

/** Whether a stored string names a real animation (used by the admin API too). */
export function isWidgetAnimation(value: string): value is SupportWidgetAnimation {
  return (WIDGET_ANIMATIONS as readonly string[]).includes(value);
}

/**
 * A stored second-count → whole seconds, or the fallback when it is unusable.
 * Persian digits are accepted because the field is a plain number box, and a
 * negative or out-of-range value is treated as «never set» rather than obeyed.
 */
function widgetSeconds(value: string, fallback: number): number {
  const seconds = Number.parseInt(fromFaDigits(value).trim(), 10);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_WIDGET_SECONDS) {
    return fallback;
  }
  return seconds;
}

/**
 * The stored widget settings → what the storefront widget renders. Never
 * throws: an unrecognised position or animation falls back to the default one,
 * so a half-saved or hand-edited row can only ever produce a plainer widget.
 */
export function resolveSupportWidgetConfig(settings: SupportWidgetSettings): SupportWidgetConfig {
  return {
    position: isWidgetPosition(settings.supportWidgetPosition)
      ? settings.supportWidgetPosition
      : DEFAULT_SUPPORT_WIDGET_CONFIG.position,
    animation: isWidgetAnimation(settings.supportWidgetAnimation)
      ? settings.supportWidgetAnimation
      : DEFAULT_SUPPORT_WIDGET_CONFIG.animation,
    delayMs: widgetSeconds(settings.supportWidgetDelay, 0) * 1000,
    noticeEnabled: settings.supportWidgetNoticeEnabled,
    noticeMs:
      widgetSeconds(
        settings.supportWidgetNoticeSeconds,
        DEFAULT_SUPPORT_WIDGET_CONFIG.noticeMs / 1000
      ) * 1000,
  };
}
