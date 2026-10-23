/**
 * تایپ‌ها و ثابت‌های مشترک تیکتینگ سمت کور — آینه components/tickets/tickets-shared.ts
 * نسخه فروشگاه (همگام‌سازی دستی). هم TicketsManager و هم TicketConversation از
 * همین فایل مصرف می‌کنند تا import چرخه‌ای شکل نگیرد.
 *
 * واژه‌نامه وضعیت و قاعده نخوانده از core/lib/ticket-status می‌آید (خالص، بدون
 * Prisma) تا سرور و کلاینت یک تعریف داشته باشند — همان الگوی نسخه مرجع.
 */

import { isUnreadForSide, type TicketSideRole } from '@/lib/ticket-status';

export interface GenericTicketMessage {
  id: string;
  authorSide: string;
  authorName: string;
  body: string;
  /** تصویر پیوست — کور فعلاً پیوست ندارد (اسکیمای TicketMessage ستون imagePath
   *  ندارد)؛ فیلد برای هم‌شکلی با نسخه فروشگاه اختیاری نگه داشته شده است. */
  imagePath?: string | null;
  createdAt: string | Date;
}

export interface GenericTicket {
  id: string;
  /** شناسه انسانی «TK-#####» — در لیست و سربرگ گفتگو نمایش داده می‌شود. */
  displayId: string;
  subject: string;
  status: string;
  requesterName: string;
  /** موبایل درخواست‌کننده — فقط سمت فروشگاه؛ کور ندارد. */
  requesterPhone?: string | null;
  /** تیکت مهمان — فقط سمت فروشگاه. */
  isGuest?: boolean;
  /** برچسب طرف مقابل (دامنه در پنل Core). */
  counterpart?: string | null;
  /** پیش‌نمایش یک‌خطی آخرین پیام برای لیست. */
  lastMessage: string;
  lastMessageAt: string | Date;
  lastMessageAuthor: string;
  /** آخرین بازدید دو طرف — ورودی قاعده نخوانده مشتق. */
  requesterReadAt: string | Date | null;
  supporterReadAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  /** رشته کامل پیام‌ها — فقط رکورد «کامل» (خروجی GET [id] / getTicketFull)
   *  دارد؛ ردیف لیست فقط پیش‌نمایش lastMessage حمل می‌کند. */
  messages?: GenericTicketMessage[];
}

/** عملیات نوشتن — ساید کور با API خودش (/api/tickets) پیاده می‌کند. */
export interface TicketAdapter {
  create: (input: { subject: string; body: string }) => Promise<string | null>;
  reply: (id: string, body: string, imagePath?: string) => Promise<boolean>;
  /** آپلود تصویر پیوست — کور فعلاً ندارد؛ نبودش یعنی دکمه پیوست در UI نیست. */
  uploadImage?: (file: File) => Promise<string | null>;
  /** فقط سمت پشتیبان: 'closed' بستن، 'open' بازگشایی (قفل مرجع). */
  setStatus?: (id: string, status: string) => Promise<boolean>;
  /** فقط سمت پشتیبان — بستن همان setStatus 'closed' است. */
  close?: (id: string) => Promise<boolean>;
  /** ثبت بازدید بیننده (پاک‌کردن بج نخوانده همان سمت) — GET همان سمت. */
  markRead?: (id: string) => Promise<void>;
  /** تازه‌سازی یک تیکت برای polling گفتگو (۱۰ ثانیه visibility-gated). */
  refreshTicket?: (id: string) => Promise<GenericTicket | null>;
}

export interface TicketRoleConfig {
  /** سمتِ کاربر فعلی — حباب پیام‌های خودش سمت مقابل می‌گیرد. */
  viewerSide: 'core' | 'tenant' | 'owner' | 'customer';
  /** برچسب نمایشی دو طرف. */
  selfLabel: string;
  otherLabel: string;
  /** آیا این ساید می‌تواند وضعیت تیکت را عوض کند — بازگشایی فقط از همین سمت. */
  canManageStatus: boolean;
}

/** نقشِ بیننده در گفتگوی دوطرفه: پشتیبان‌ها supporter، درخواست‌کننده‌ها requester. */
export function viewerSideRole(viewerSide: TicketRoleConfig['viewerSide']): TicketSideRole {
  return viewerSide === 'core' || viewerSide === 'owner' ? 'supporter' : 'requester';
}

/** قاعده نخوانده برای بیننده — تک منبع مصرفی لیست‌ها و زنگ‌اخبار. */
export function isUnreadForViewer(
  viewerSide: TicketRoleConfig['viewerSide'],
  ticket: GenericTicket
): boolean {
  return isUnreadForSide(viewerSideRole(viewerSide), {
    lastMessageAt: ticket.lastMessageAt,
    lastMessageAuthor: ticket.lastMessageAuthor,
    requesterReadAt: ticket.requesterReadAt,
    supporterReadAt: ticket.supporterReadAt,
  });
}
