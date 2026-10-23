/**
 * تایپ‌ها و ثابت‌های مشترک تیکتینگ — ژنریک بین پنل Core و داشبورد فروشگاه؛
 * هم TicketsManager و هم TicketConversation از همین فایل مصرف می‌کنند تا
 * import چرخه‌ای شکل نگیرد.
 *
 * واژه‌نامه وضعیت و قاعده نخوانده از lib/ticket-status می‌آید (خالص، بدون
 * Prisma) تا سرور و کلاینت یک تعریف داشته باشند — همان الگوی نسخه مرجع.
 */

import { isUnreadForSide, type TicketSideRole } from '@/lib/ticket-status';

export interface GenericTicketMessage {
  id: string;
  authorSide: string;
  authorName: string;
  body: string;
  /** تصویر پیوست — مسیر نسبی uploads/ (سمت فروشگاه)؛ سرو با /api/files/…. */
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
  /** موبایل درخواست‌کننده وقتی شناخته است (سمت فروشگاه؛ کور ندارد). */
  requesterPhone?: string | null;
  /** تیکت بدون حساب پشت آن (مهمان) — فقط سمت فروشگاه. */
  isGuest?: boolean;
  /** برچسب اختیاری طرف مقابل (دامنه در پنل Core، نام مشتری در داشبورد). */
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
  /** رشته کامل پیام‌ها — فقط رکورد «کامل» (خروجی GET [id]) دارد؛ ردیف لیست
   *  فقط پیش‌نمایش lastMessage را حمل می‌کند و گفتگو با refreshTicket
   *  کاملش را می‌گیرد. */
  messages?: GenericTicketMessage[];
}

export const TICKET_STATUS_LABEL: Record<string, string> = {
  open: 'در انتظار پاسخ',
  answered: 'پاسخ داده شده',
  closed: 'بسته',
};

export const TICKET_STATUS_COLOR: Record<string, string> = {
  open: 'orange',
  answered: 'teal',
  closed: 'gray',
};

/** عملیات نوشتن — هر ساید با API خودش پیاده می‌کند. */
export interface TicketAdapter {
  create: (input: { subject: string; body: string }) => Promise<string | null>;
  reply: (id: string, body: string, imagePath?: string) => Promise<boolean>;
  /** آپلود تصویر پیوست (JPG/PNG، سقف ۲۰۰KB سمت سرور) — سمت‌هایی که عکس
   *  می‌پذیرند پیاده می‌کنند؛ نبودش یعنی دکمه پیوست در UI نیست. */
  uploadImage?: (file: File) => Promise<string | null>;
  /** فقط سمت پشتیبان: 'closed' بستن، 'open' بازگشایی (قفل مرجع). */
  setStatus?: (id: string, status: string) => Promise<boolean>;
  /** فقط سمت پشتیبان — بستن همان setStatus 'closed' است؛ درخواست‌کننده ندارد. */
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
  /** آیا این ساید می‌تواند وضعیت تیکت را عوض کند (پشتیبان هر دو ساید) —
   *  بازگشایی تیکت بسته فقط از همین سمت انجام می‌شود. */
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
