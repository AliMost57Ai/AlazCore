/**
 * منطق دامین تیکت پشتیبانی مشتری↔مالک فروشگاه — پورت lib/support.ts نسخه
 * مرجع (TicketingSys).
 *
 * یک تیکت یک گفتگو است: مشتری از ویجت چت فروشگاه یا /account/support می‌نویسد
 * و پشتیبان از پنل (/customer-support) پاسخ می‌دهد. مهمان‌ها هم می‌توانند گفتگو
 * را شروع کنند اما اول باید نام و موبایل بدهند — تیکت‌شان userId ندارد و با
 * توکن opaque داخل کوکی mnt_support شناخته می‌شود (lib/support-viewer.ts).
 *
 * Server-only — lib/db را import می‌کند. واژه‌نامه وضعیت و قاعده نخوانده در
 * lib/ticket-status.ts است تا کلاینت هم بدون دیتابیس همان تعریف را داشته باشد.
 */

import prisma from './db';
import { faJalaliDate } from './format';
import { listCustomerOrders } from './shop-orders';
import { isUnreadForSide, toTicketStatus, type TicketSideRole } from './ticket-status';
import { listWalletTransactions, WALLET_TX_LABELS, type WalletTxType } from './wallet';

/** بلندترین پیام پذیرفته‌شده — تا یک تیکت رمان نشود. */
const MAX_BODY = 2000;
/** بلندترین موضوعی که درخواست‌کننده می‌تواند بدهد. */
const MAX_SUBJECT = 120;
/** سقف تیکت باز هر حساب/مهمان در یک لحظه (آنتی‌اسپم مرجع). */
const MAX_OPEN_TICKETS = 5;
/** چند نویسه اول پیام مهمان موضوع تیکتش می‌شود. */
const GUEST_SUBJECT_LENGTH = 60;

export type SupportResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** یک ردیف لیست تیکت (ویجت مشتری یا جدول پنل). */
export interface SupportTicketDTO {
  id: string;
  displayId: string;
  subject: string;
  status: string;
  /** نام نمایشی درخواست‌کننده — نام حساب یا نام داده‌شده مهمان. */
  requesterName: string;
  /** موبایل درخواست‌کننده وقتی شناخته است (برای مهمان همیشه). */
  requesterPhone: string | null;
  /** تیکت بدون حساب پشت آن (مهمان). */
  isGuest: boolean;
  /** شناسه حساب درخواست‌کننده — برای مهمان null. */
  userId: string | null;
  /** پیش‌نمایش یک‌خطی آخرین پیام. */
  lastMessage: string;
  lastMessageAuthor: string;
  /** تاریخ جلالی آخرین پیام (هیدرشن-سیف). */
  lastMessageDate: string;
  lastMessageAt: string;
  /** مشتق، هرگز شمارنده نیست — به‌سوی sideِ بیننده. */
  unread: boolean;
  createdAt: string;
}

/** یک پیام داخل رشته گفتگو. */
export interface SupportMessageDTO {
  id: string;
  authorSide: string;
  authorName: string;
  body: string;
  /** تصویر پیوست — مسیر نسبی uploads/؛ فقط پیام‌های دارای پیوست مقدار دارند. */
  imagePath: string | null;
  /** تاریخ+ساعت جلالی، مثل «۱۴۰۴/۰۷/۲۵ ۱۴:۳۰». */
  date: string;
  createdAt: string;
}

/** تیکت با رشته کامل پیام‌ها. */
export interface SupportTicketDetailDTO extends SupportTicketDTO {
  messages: SupportMessageDTO[];
}

/** ستون‌های مشترک هر پروجکشن تیکت — پیش‌نمایش آخرین پیام را هم می‌آورد. */
const TICKET_SELECT = {
  id: true,
  displayId: true,
  subject: true,
  status: true,
  userId: true,
  guestName: true,
  guestPhone: true,
  lastMessageAt: true,
  lastMessageAuthor: true,
  customerReadAt: true,
  staffReadAt: true,
  createdAt: true,
  user: { select: { name: true, phone: true } },
  messages: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { body: true },
  },
} as const;

type TicketRow = {
  id: string;
  displayId: string;
  subject: string;
  status: string;
  userId: string | null;
  guestName: string | null;
  guestPhone: string | null;
  lastMessageAt: Date;
  lastMessageAuthor: string;
  customerReadAt: Date | null;
  staffReadAt: Date | null;
  createdAt: Date;
  user: { name: string; phone: string | null } | null;
  messages: { body: string }[];
};

function preview(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > 90 ? `${flat.slice(0, 90)}…` : flat;
}

function unreadFor(row: TicketRow, side: TicketSideRole): boolean {
  return isUnreadForSide(side, {
    lastMessageAt: row.lastMessageAt,
    lastMessageAuthor: row.lastMessageAuthor,
    requesterReadAt: row.customerReadAt,
    supporterReadAt: row.staffReadAt,
  });
}

/** ردیف کوئری‌شده → DTO با نخوانده‌ی مشتق برای side. */
function toTicketDTO(row: TicketRow, side: TicketSideRole): SupportTicketDTO {
  return {
    id: row.id,
    displayId: row.displayId,
    subject: row.subject,
    status: toTicketStatus(row.status),
    requesterName: row.user?.name ?? row.guestName ?? 'مهمان',
    requesterPhone: row.user?.phone ?? row.guestPhone ?? null,
    isGuest: row.userId === null,
    userId: row.userId,
    lastMessage: preview(row.messages[0]?.body ?? ''),
    lastMessageAuthor: row.lastMessageAuthor,
    lastMessageDate: faJalaliDate(row.lastMessageAt),
    lastMessageAt: row.lastMessageAt.toISOString(),
    unread: unreadFor(row, side),
    createdAt: row.createdAt.toISOString(),
  };
}

/** تیکت‌های خود مشتری، تازه‌ترین فعالیت اول. */
export async function listTicketsForCustomer(userId: string): Promise<SupportTicketDTO[]> {
  const rows = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { lastMessageAt: 'desc' },
    select: TICKET_SELECT,
  });
  return rows.map((row) => toTicketDTO(row, 'requester'));
}

/** تیکت‌های مهمان — با توکن قابلیت داخل کوکی‌اش. */
export async function listTicketsForGuestToken(token: string): Promise<SupportTicketDTO[]> {
  if (!token) {
    return [];
  }
  const rows = await prisma.supportTicket.findMany({
    where: { guestToken: token },
    orderBy: { lastMessageAt: 'desc' },
    select: TICKET_SELECT,
  });
  return rows.map((row) => toTicketDTO(row, 'requester'));
}

/** همه تیکت‌ها برای پنل پشتیبان — قرارداد ریپو: load-all، فیلتر سمت کلاینت. */
export async function listTicketsForStaff(): Promise<SupportTicketDTO[]> {
  const rows = await prisma.supportTicket.findMany({
    orderBy: { lastMessageAt: 'desc' },
    select: TICKET_SELECT,
  });
  return rows.map((row) => toTicketDTO(row, 'supporter'));
}

/**
 * تیکت‌های «در انتظار پشتیبان» — ردیف‌های سبک برای زنگ‌اخبار پنل و اعلان زنده
 * «تیکت جدید» (تازه‌ترین فعالیت اول). قاعده نخوانده همان مشتق مرجع است
 * (مقایسه دو ستون در SQLite قابل بیان در where نیست، پس در JS فیلتر می‌شود).
 */
export async function listUnreadForStaff(): Promise<
  { id: string; displayId: string; subject: string; requesterName: string }[]
> {
  const rows = await prisma.supportTicket.findMany({
    where: { status: { not: 'closed' }, lastMessageAuthor: 'customer' },
    orderBy: { lastMessageAt: 'desc' },
    select: {
      id: true,
      displayId: true,
      subject: true,
      guestName: true,
      lastMessageAt: true,
      lastMessageAuthor: true,
      staffReadAt: true,
      customerReadAt: true,
      user: { select: { name: true } },
    },
  });
  return rows
    .filter((row) =>
      isUnreadForSide('supporter', {
        lastMessageAt: row.lastMessageAt,
        lastMessageAuthor: row.lastMessageAuthor,
        requesterReadAt: row.customerReadAt,
        supporterReadAt: row.staffReadAt,
      })
    )
    .map((row) => ({
      id: row.id,
      displayId: row.displayId,
      subject: row.subject,
      requesterName: row.user?.name ?? row.guestName ?? 'مهمان',
    }));
}

/** شمار تیکت‌های «در انتظار پشتیبان» — همان listUnreadForStaff به‌صورت عدد. */
export async function countUnreadForStaff(): Promise<number> {
  return (await listUnreadForStaff()).length;
}

/**
 * یک تیکت برای بیننده — با اعمال مالکیت: مشتری فقط تیکت خودش، مهمان فقط
 * پشت توکن کوکی‌اش، پشتیبان همه را. تیکتی که به بیننده تعلق ندارد null
 * برمی‌گردد و مسیرها به هر حال ۴۰۴ می‌دهند تا id قابل حدس‌زدن نباشد.
 */
export async function getTicketForViewer(
  id: string,
  viewer:
    | { kind: 'customer'; userId: string }
    | { kind: 'guest'; token: string }
    | { kind: 'staff' }
): Promise<SupportTicketDetailDTO | null> {
  const row = await prisma.supportTicket.findUnique({
    where: { id },
    select: {
      ...TICKET_SELECT,
      guestToken: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          authorSide: true,
          authorName: true,
          body: true,
          imagePath: true,
          createdAt: true,
        },
      },
    },
  });
  if (!row) {
    return null;
  }

  if (viewer.kind === 'customer' && row.userId !== viewer.userId) {
    return null;
  }
  if (viewer.kind === 'guest') {
    // توکن ادعاشده باید با ذخیره‌شده بخواند؛ توکن خالی هرگز نمی‌خواند.
    if (!viewer.token || row.guestToken !== viewer.token) {
      return null;
    }
  }

  const side: TicketSideRole = viewer.kind === 'staff' ? 'supporter' : 'requester';

  return {
    ...toTicketDTO(row, side),
    messages: row.messages.map((message) => ({
      id: message.id,
      authorSide: message.authorSide,
      authorName: message.authorName,
      body: message.body,
      imagePath: message.imagePath,
      date: faJalaliDateTime(message.createdAt),
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

/** اعتبارسنجی متن پیام — خطای فارسی یا null. پیامِ فقط-تصویری مجاز است:
 *  وقتی imagePath معتبر داریم، متن خالی هم قبول است. */
function validateBody(body: unknown, hasImage = false): string | null {
  if (typeof body !== 'string' || body.trim().length === 0) {
    return hasImage ? null : 'متن پیام را بنویسید.';
  }
  if (body.trim().length > MAX_BODY) {
    return `متن پیام نمی‌تواند بیشتر از ${MAX_BODY} نویسه باشد.`;
  }
  return null;
}

/**
 * اعتبارسنجی مسیر تصویر پیوست — فقط رشتهٔ نسبی زیر uploads/ از خروجی
 * saveSupportImage می‌پذیرد؛ هر چیز دیگری (مسیر مطلق، ../، کلید خارجی)
 * null می‌شود تا هرگز مسیر دلخواه کلاینت سرو نشود.
 */
function sanitizeImagePath(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const value = raw.trim();
  return /^uploads\/[\w-]+\.(png|jpg)$/.test(value) && value.length <= 200 ? value : null;
}

/** `TK-` + ۵ رقم، با retry روی برخورد (به‌شدت کم‌احتمال) unique. */
async function nextDisplayId(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `TK-${String(10_000 + Math.floor(Math.random() * 90_000))}`;
    const taken = await prisma.supportTicket.findUnique({
      where: { displayId: candidate },
      select: { id: true },
    });
    if (!taken) {
      return candidate;
    }
  }
  // عملاً دست‌نیافتنی؛ پسوند زمانی در هر حال unique نگه می‌دارد.
  return `TK-${Date.now().toString().slice(-5)}`;
}

/** باز کردن تیکت برای مشتری واردشده، با اولین پیامش. */
export async function createCustomerTicket(input: {
  userId: string;
  name: string;
  subject: string;
  body: string;
}): Promise<SupportResult<{ id: string; displayId: string }>> {
  const subject = input.subject.trim();
  if (subject.length < 2) {
    return { ok: false, error: 'موضوع تیکت را بنویسید.' };
  }
  if (subject.length > MAX_SUBJECT) {
    return { ok: false, error: `موضوع تیکت نمی‌تواند بیشتر از ${MAX_SUBJECT} نویسه باشد.` };
  }
  const bodyError = validateBody(input.body);
  if (bodyError) {
    return { ok: false, error: bodyError };
  }

  const open = await prisma.supportTicket.count({
    where: { userId: input.userId, status: { not: 'closed' } },
  });
  if (open >= MAX_OPEN_TICKETS) {
    return {
      ok: false,
      error: `حداکثر ${MAX_OPEN_TICKETS} تیکت باز هم‌زمان دارید — اول یکی را ببندید یا پاسخش را بخوانید.`,
    };
  }

  const now = new Date();
  const ticket = await prisma.supportTicket.create({
    data: {
      displayId: await nextDisplayId(),
      userId: input.userId,
      subject,
      status: 'open',
      // نویسنده اولین پیام خودش خوانده‌اش کرده؛ پشتیبان هنوز نخوانده.
      customerReadAt: now,
      lastMessageAt: now,
      lastMessageAuthor: 'customer',
      messages: {
        create: { authorSide: 'customer', authorName: input.name, body: input.body.trim() },
      },
    },
    select: { id: true, displayId: true },
  });

  return { ok: true, value: ticket };
}

/**
 * باز کردن تیکت برای مهمان — نام و موبایل لازم است (قاعده مرجع: مهمان قبل از
 * اولین پیام باید شناسایی شود) و موضوع از دل اولین پیام ساخته می‌شود چون
 * مهمان فقط یک فیلد دارد. توکن قابلیتی که در کوکی mnt_support می‌نشیند
 * برگردانده می‌شود.
 *
 * سقف ۵ تیکت باز به‌ازای شماره موبایل — نه فقط per-token: مهمانِ بدون کوکی
 * (یا کوکیِ پاک‌شده) وگرنه با هر POST توکن تازه و سهمیه تازه می‌گرفت.
 */
export async function createGuestTicket(input: {
  name: string;
  phone: string;
  body: string;
}): Promise<SupportResult<{ id: string; displayId: string; token: string }>> {
  const name = input.name.trim();
  if (name.length < 2) {
    return { ok: false, error: 'نام خود را بنویسید.' };
  }
  const bodyError = validateBody(input.body);
  if (bodyError) {
    return { ok: false, error: bodyError };
  }
  if (!input.phone) {
    return { ok: false, error: 'شماره موبایل باید با ۰۹ شروع شود و دقیقاً ۱۱ رقم باشد.' };
  }

  const open = await prisma.supportTicket.count({
    where: { guestPhone: input.phone, userId: null, status: { not: 'closed' } },
  });
  if (open >= MAX_OPEN_TICKETS) {
    return {
      ok: false,
      error: `حداکثر ${MAX_OPEN_TICKETS} تیکت باز هم‌زمان با این شماره مجاز است — اول منتظر پاسخ بمانید یا تیکت قبلی را ببندید.`,
    };
  }

  const body = input.body.trim();
  const token = crypto.randomUUID();
  const now = new Date();

  const ticket = await prisma.supportTicket.create({
    data: {
      displayId: await nextDisplayId(),
      guestName: name,
      guestPhone: input.phone,
      guestToken: token,
      subject:
        body.length > GUEST_SUBJECT_LENGTH ? `${body.slice(0, GUEST_SUBJECT_LENGTH)}…` : body,
      status: 'open',
      customerReadAt: now,
      lastMessageAt: now,
      lastMessageAuthor: 'customer',
      messages: {
        create: { authorSide: 'customer', authorName: name, body },
      },
    },
    select: { id: true, displayId: true },
  });

  return { ok: true, value: { ...ticket, token } };
}

/**
 * افزودن پیام و پیش بردن تیکت: پیام درخواست‌کننده آن را به open «در انتظار
 * پاسخ» می‌برد و پاسخ پشتیبان answered می‌کند. تیکت بسته پیام نمی‌پذیرد —
 * بازگشایی اکشن صریح پشتیبان است (setTicketStatus) تا گفتگوی تمام‌شده هرگز
 * بی‌صدا زنده نشود.
 */
export async function addMessage(
  ticketId: string,
  author: { side: 'customer' | 'owner'; name: string },
  body: string,
  imagePath?: unknown
): Promise<SupportResult<{ id: string }>> {
  const image = sanitizeImagePath(imagePath);
  const bodyError = validateBody(body, image !== null);
  if (bodyError) {
    return { ok: false, error: bodyError };
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { status: true },
  });
  if (!ticket) {
    return { ok: false, error: 'تیکت یافت نشد.' };
  }
  if (ticket.status === 'closed') {
    return { ok: false, error: 'این تیکت بسته شده است — برای ادامه، تیکت تازه‌ای بسازید.' };
  }

  const now = new Date();
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.supportTicketMessage.create({
      data: {
        ticketId,
        authorSide: author.side,
        authorName: author.name,
        body: body.trim(),
        ...(image ? { imagePath: image } : {}),
      },
      select: { id: true },
    });

    await tx.supportTicket.update({
      where: { id: ticketId },
      data: {
        lastMessageAt: now,
        lastMessageAuthor: author.side,
        // سمتِ همین الان نوشته، تا همین لحظه را خوانده است.
        ...(author.side === 'owner' ? { staffReadAt: now } : { customerReadAt: now }),
        status: author.side === 'owner' ? 'answered' : 'open',
      },
    });

    return created;
  });

  return { ok: true, value: message };
}

/** بستن یا بازگشایی تیکت — اکشن پشتیبان. */
export async function setTicketStatus(
  id: string,
  status: 'open' | 'answered' | 'closed'
): Promise<SupportResult<null>> {
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true } });
  if (!ticket) {
    return { ok: false, error: 'تیکت یافت نشد.' };
  }
  await prisma.supportTicket.update({ where: { id }, data: { status } });
  return { ok: true, value: null };
}

/** ثبت بازدید یک سمت — بج نخوانده همان سمت را پاک می‌کند. */
export async function markTicketRead(id: string, side: 'customer' | 'owner'): Promise<void> {
  await prisma.supportTicket.updateMany({
    where: { id },
    data: side === 'owner' ? { staffReadAt: new Date() } : { customerReadAt: new Date() },
  });
}

/* ---------------------------------------------------------------------------
 * پنل Context پشتیبان: آخرین سفارش و کیف پول مشتری. فقط-خواندنی به‌صورت عمدی
 * — «پاسخ‌دادن به تیکت هرگز پول جابه‌جا نمی‌کند».
 * ------------------------------------------------------------------------ */

export interface WalletLineDTO {
  id: string;
  /** برچسب فارسی از WALLET_TX_LABELS. */
  label: string;
  amount: number;
  date: string;
}

export interface CustomerContextDTO {
  userId: string;
  name: string;
  phone: string | null;
  email: string | null;
  walletBalance: number;
  /** آخرین سفارش، یا null وقتی هیچ‌وقت سفارش نداده. */
  lastOrder: {
    displayId: string;
    date: string;
    amount: number;
    /** کلید خام وضعیت — پنل با STATUS_LABELS/COLORS نگاشت می‌کند. */
    status: string;
    trackingCode: string | null;
  } | null;
  /** مجموع سفارش‌های ثبت‌شده. */
  orderCount: number;
  /** چند تراکنش آخر کیف پول. */
  walletLines: WalletLineDTO[];
  /** تیکت‌های بازی که این مشتری همین حالا دارد. */
  openTicketCount: number;
}

/** همه‌چیزی که پشتیبان برای پاسخ با Context لازم دارد. برای تیکت مهمان null. */
export async function getCustomerContext(userId: string): Promise<CustomerContextDTO | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, phone: true, email: true, walletBalance: true },
  });
  if (!user) {
    return null;
  }

  const [orders, ledger, openTicketCount] = await Promise.all([
    listCustomerOrders(userId),
    listWalletTransactions(userId),
    prisma.supportTicket.count({ where: { userId, status: { not: 'closed' } } }),
  ]);

  // «آخرین سفارش» از نگاه پشتیبان = جاری‌ترین سفارشِ در جریان است، نه آخرین
  // رکورد — سفارش فعال ممکن است دیرتر از آخرین سفارش تحویل‌شده پرداخت شده
  // باشد و همان چیزی است که پشتیبان باید ببیند (ORD-51623 در برابر ORD-70949).
  const activeOrder = orders.find(
    (order) => order.status !== 'delivered' && order.status !== 'cancelled'
  );
  const latest = activeOrder ?? orders[0] ?? null;

  return {
    userId: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    walletBalance: user.walletBalance,
    orderCount: orders.length,
    lastOrder: latest
      ? {
          displayId: latest.displayId,
          date: latest.date,
          amount: latest.amount,
          status: latest.status,
          trackingCode: latest.trackingCode,
        }
      : null,
    walletLines: ledger.slice(0, 5).map((row) => ({
      id: row.id,
      label: WALLET_TX_LABELS[row.type as WalletTxType] ?? row.type,
      amount: row.amount,
      date: row.date,
    })),
    openTicketCount,
  };
}

/** تاریخ+ساعت جلالی — نیمه تاریخ از تبدیل دست‌ساز lib/format (هرگز Intl —
 *  تفاوت ICU بین Node/مرورگر خودش را هیدرشن-میس‌مچ نشان می‌دهد)؛ نیمه ساعت
 *  ارقام صفر-پر شده ساده. */
function faJalaliDateTime(value: Date): string {
  const clock = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  return `${faJalaliDate(value)} ${clock}`;
}
