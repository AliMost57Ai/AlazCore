/**
 * منطق دامین تیکت پشتیبانی مالک سایت ↔ پشتیبان کور — آینه lib/customer-tickets.ts
 * بدون بخش مهمان/مشتری (این گفتگو B2B است).
 *
 * واژه‌نامه وضعیت و قاعده نخوانده در core/lib/ticket-status.ts است تا پنل کور و
 * کلاینت‌ها همان تعریف سرور را داشته باشند. سقف ۵ تیکت باز به‌ازای هر دامنه،
 * displayId «TK-#####» و قفل تیکت بسته — همان قواعد مرجع.
 */

import prisma from '@/lib/db';
import { isUnreadForSide, toTicketStatus, type TicketSideRole } from '@/lib/ticket-status';

/** بلندترین پیام پذیرفته‌شده. */
const MAX_BODY = 2000;
/** بلندترین موضوع. */
const MAX_SUBJECT = 120;
/** سقف تیکت باز هر دامنه در یک لحظه (آنتی‌اسپم مرجع). */
const MAX_OPEN_TICKETS = 5;

export type TicketResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** یک ردیف لیست تیکت — همان ساختار GenericTicket کامپوننت ژنریک. */
export interface TicketDTO {
  id: string;
  displayId: string;
  subject: string;
  status: string;
  requesterName: string;
  /** برچسب دامنه — در پنل کور ستون طرف مقابل. */
  counterpart?: string | null;
  /** پیش‌نمایش یک‌خطی آخرین پیام. */
  lastMessage: string;
  lastMessageAt: string;
  lastMessageAuthor: string;
  /** آخرین بازدید دو طرف — ورودی قاعده نخوانده مشتق. */
  requesterReadAt: string | null;
  supporterReadAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessageDTO[];
}

export interface TicketMessageDTO {
  id: string;
  authorSide: string;
  authorName: string;
  body: string;
  createdAt: string;
}

/** ستون‌های مشترک هر پروجکشن تیکت — پیش‌نمایش آخرین پیام را هم می‌آورد. */
const TICKET_SELECT = {
  id: true,
  displayId: true,
  subject: true,
  status: true,
  requesterName: true,
  lastMessageAt: true,
  lastMessageAuthor: true,
  coreReadAt: true,
  tenantReadAt: true,
  createdAt: true,
  updatedAt: true,
  domain: { select: { domain: true } },
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { body: true },
  },
} as const;

type TicketRow = {
  id: string;
  displayId: string;
  subject: string;
  status: string;
  requesterName: string;
  lastMessageAt: Date;
  lastMessageAuthor: string;
  coreReadAt: Date | null;
  tenantReadAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  domain: { domain: string } | null;
  messages: { body: string }[];
};

function preview(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > 90 ? `${flat.slice(0, 90)}…` : flat;
}

/** ردیف کوئری‌شده → DTO با نخوانده‌ی مشتق برای side. */
function toTicketDTO(row: TicketRow, side: TicketSideRole): TicketDTO {
  return {
    id: row.id,
    displayId: row.displayId,
    subject: row.subject,
    status: toTicketStatus(row.status),
    requesterName: row.requesterName,
    counterpart: row.domain?.domain ?? null,
    lastMessage: preview(row.messages[0]?.body ?? ''),
    lastMessageAt: row.lastMessageAt.toISOString(),
    lastMessageAuthor: row.lastMessageAuthor,
    requesterReadAt: row.tenantReadAt ? row.tenantReadAt.toISOString() : null,
    supporterReadAt: row.coreReadAt ? row.coreReadAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messages: [],
  };
}

/** تیکت‌های همه دامنه‌ها برای پنل کور — قرارداد load-all. */
export async function listTicketsForCore(): Promise<TicketDTO[]> {
  const rows = await prisma.ticket.findMany({
    orderBy: { lastMessageAt: 'desc' },
    select: TICKET_SELECT,
  });
  return rows.map((row) => toTicketDTO(row, 'supporter'));
}

/** تیکت‌های یک دامنه — سمت مستأجر. */
export async function listTicketsForDomain(domainId: string): Promise<TicketDTO[]> {
  const rows = await prisma.ticket.findMany({
    where: { domainId },
    orderBy: { lastMessageAt: 'desc' },
    select: TICKET_SELECT,
  });
  return rows.map((row) => toTicketDTO(row, 'requester'));
}

/**
 * شمار تیکت‌های «در انتظار پشتیبان کور» برای بج منو — قاعده نخوانده مشتق
 * (مقایسه دو ستون در SQLite در where نمی‌گنجد؛ شمارش در JS، رفتار مرجع).
 */
export async function countUnreadForCore(): Promise<number> {
  const rows = await prisma.ticket.findMany({
    where: { status: { not: 'closed' }, lastMessageAuthor: 'tenant' },
    select: { lastMessageAt: true, lastMessageAuthor: true, coreReadAt: true, tenantReadAt: true },
  });
  return rows.filter(
    (row) =>
      isUnreadForSide('supporter', {
        lastMessageAt: row.lastMessageAt,
        lastMessageAuthor: row.lastMessageAuthor,
        requesterReadAt: row.tenantReadAt,
        supporterReadAt: row.coreReadAt,
      })
  ).length;
}

/**
 * آخرین تیکت «در انتظار پشتیبان کور» برای متن اعلان زندهٔ «تیکت جدید» — null
 * اگر چیزی در انتظار نیست. همان قاعده نخوانده مشتقِ countUnreadForCore.
 */
export async function latestUnreadForCore(): Promise<{
  displayId: string;
  requesterName: string;
  subject: string;
} | null> {
  const rows = await prisma.ticket.findMany({
    where: { status: { not: 'closed' }, lastMessageAuthor: 'tenant' },
    orderBy: { lastMessageAt: 'desc' },
    select: {
      displayId: true,
      requesterName: true,
      subject: true,
      lastMessageAt: true,
      lastMessageAuthor: true,
      coreReadAt: true,
      tenantReadAt: true,
    },
  });
  const unread = rows.filter(
    (row) =>
      isUnreadForSide('supporter', {
        lastMessageAt: row.lastMessageAt,
        lastMessageAuthor: row.lastMessageAuthor,
        requesterReadAt: row.tenantReadAt,
        supporterReadAt: row.coreReadAt,
      })
  );
  const latest = unread[0];
  if (!latest) {
    return null;
  }
  return {
    displayId: latest.displayId,
    requesterName: latest.requesterName,
    subject: latest.subject,
  };
}

/** یک تیکت با رشته کامل — مالکیت دامنه بیرون این تابع اعمال می‌شود. */
export async function getTicketFull(
  id: string,
  domainId?: string
): Promise<(TicketDTO & { messages: TicketMessageDTO[] }) | null> {
  const row = await prisma.ticket.findUnique({
    where: { id },
    include: { domain: { select: { domain: true } }, messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!row || (domainId !== undefined && row.domainId !== domainId)) {
    return null;
  }

  return {
    id: row.id,
    displayId: row.displayId,
    subject: row.subject,
    status: toTicketStatus(row.status),
    requesterName: row.requesterName,
    counterpart: row.domain?.domain ?? null,
    lastMessage: preview([...row.messages].reverse()[0]?.body ?? ''),
    lastMessageAt: row.lastMessageAt.toISOString(),
    lastMessageAuthor: row.lastMessageAuthor,
    requesterReadAt: row.tenantReadAt ? row.tenantReadAt.toISOString() : null,
    supporterReadAt: row.coreReadAt ? row.coreReadAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messages: row.messages.map((message) => ({
      id: message.id,
      authorSide: message.authorSide,
      authorName: message.authorName,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

/** `TK-` + ۵ رقم، با retry روی برخورد unique. */
async function nextDisplayId(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `TK-${String(10_000 + Math.floor(Math.random() * 90_000))}`;
    const taken = await prisma.ticket.findUnique({
      where: { displayId: candidate },
      select: { id: true },
    });
    if (!taken) {
      return candidate;
    }
  }
  return `TK-${Date.now().toString().slice(-5)}`;
}

/** اعتبارسنجی موضوع + متن — خطای فارسی یا null. */
export function validateTicketInput(
  subject: unknown,
  body: unknown
): { subject: string; body: string } | { error: string } {
  const cleanSubject = typeof subject === 'string' ? subject.trim() : '';
  const cleanBody = typeof body === 'string' ? body.trim() : '';
  if (cleanSubject.length < 2 || cleanSubject.length > MAX_SUBJECT) {
    return { error: `موضوع تیکت باید بین ۲ تا ${MAX_SUBJECT} نویسه باشد.` };
  }
  if (cleanBody.length === 0) {
    return { error: 'متن پیام را بنویسید.' };
  }
  if (cleanBody.length > MAX_BODY) {
    return { error: `متن پیام نمی‌تواند بیشتر از ${MAX_BODY} نویسه باشد.` };
  }
  return { subject: cleanSubject, body: cleanBody };
}

/** سقف تیکت باز دامنه — پیام خطای فارسی یا null. */
export async function checkDomainOpenCap(domainId: string): Promise<string | null> {
  const open = await prisma.ticket.count({
    where: { domainId, status: { not: 'closed' } },
  });
  if (open >= MAX_OPEN_TICKETS) {
    return `حداکثر ${MAX_OPEN_TICKETS} تیکت باز هم‌زمان برای این دامنه مجاز است.`;
  }
  return null;
}

/** باز کردن تیکت برای یک دامنه (مستأجر یا از طرف او توسط پشتیبان). */
export async function createDomainTicket(input: {
  domainId: string | null;
  requesterName: string;
  subject: string;
  body: string;
}): Promise<TicketResult<{ id: string; displayId: string }>> {
  const now = new Date();
  const ticket = await prisma.ticket.create({
    data: {
      displayId: await nextDisplayId(),
      subject: input.subject,
      domainId: input.domainId,
      requesterName: input.requesterName,
      status: 'open',
      // نویسنده اولین پیام خودش خوانده‌اش کرده؛ پشتیبان هنوز نخوانده.
      tenantReadAt: now,
      lastMessageAt: now,
      lastMessageAuthor: 'tenant',
      messages: {
        create: { authorSide: 'tenant', authorName: input.requesterName, body: input.body },
      },
    },
    select: { id: true, displayId: true },
  });
  return { ok: true, value: ticket };
}

/**
 * افزودن پیام و پیش بردن تیکت: پیام درخواست‌کننده → open «در انتظار پاسخ»،
 * پاسخ پشتیبان → answered. تیکت بسته پیام نمی‌پذیرد — بازگشایی اکشن صریح
 * پشتیبان است (setTicketStatus).
 */
export async function addTicketMessage(
  ticketId: string,
  author: { side: 'tenant' | 'core'; name: string },
  body: string
): Promise<TicketResult<{ id: string }>> {
  if (typeof body !== 'string' || body.trim().length === 0) {
    return { ok: false, error: 'متن پیام را بنویسید.' };
  }
  if (body.trim().length > MAX_BODY) {
    return { ok: false, error: `متن پیام نمی‌تواند بیشتر از ${MAX_BODY} نویسه باشد.` };
  }

  const ticket = await prisma.ticket.findUnique({
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
    const created = await tx.ticketMessage.create({
      data: {
        ticketId,
        authorSide: author.side,
        authorName: author.name,
        body: body.trim(),
      },
      select: { id: true },
    });

    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        lastMessageAt: now,
        lastMessageAuthor: author.side,
        // سمتِ همین الان نوشته، تا همین لحظه را خوانده است.
        ...(author.side === 'core' ? { coreReadAt: now } : { tenantReadAt: now }),
        status: author.side === 'core' ? 'answered' : 'open',
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
): Promise<TicketResult<null>> {
  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
  if (!ticket) {
    return { ok: false, error: 'تیکت یافت نشد.' };
  }
  await prisma.ticket.update({ where: { id }, data: { status } });
  return { ok: true, value: null };
}

/** ثبت بازدید یک سمت — بج نخوانده همان سمت را پاک می‌کند. */
export async function markTicketRead(
  id: string,
  side: 'tenant' | 'core'
): Promise<void> {
  await prisma.ticket.updateMany({
    where: { id },
    data: side === 'core' ? { coreReadAt: new Date() } : { tenantReadAt: new Date() },
  });
}
