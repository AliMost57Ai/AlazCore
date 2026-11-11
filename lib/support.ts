/**
 * Support-ticket domain logic (پشتیبانی).
 *
 * A ticket is one conversation: the customer writes from the storefront chat
 * widget or /account/support, a supporter answers from the panel (/support).
 * Guests may chat too, but only after giving a name and a mobile number — their
 * ticket carries no userId and is recognised by an opaque capability token in
 * the mnt_support cookie (lib/support-auth.ts).
 *
 * Server-only — imports lib/db. The status vocabulary and the unread rule live
 * in lib/support-status.ts so client components share them without the DB.
 */

import prisma from './db';
import { faJalaliDate } from './format';
import { listCustomerOrders } from './shop-orders';
import {
  isUnreadForCustomer,
  isUnreadForStaff,
  toTicketStatus,
  type SupportAuthorType,
  type SupportTicketStatus,
} from './support-status';
import { listWalletTransactions, WALLET_TX_LABELS, type WalletTxType } from './wallet';

/** Longest message we accept — keeps one ticket from becoming a novel. */
const MAX_BODY = 2000;
/** Longest subject a customer may give a ticket. */
const MAX_SUBJECT = 120;
/** Open tickets one account may hold at a time (anti-spam). */
const MAX_OPEN_TICKETS = 5;
/** How much of a guest's first message becomes their ticket subject. */
const GUEST_SUBJECT_LENGTH = 60;

export type SupportResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** One row in a ticket list (customer widget or panel table). */
export interface SupportTicketDTO {
  id: string;
  displayId: string;
  subject: string;
  status: SupportTicketStatus;
  /** Requester display name — the account name, or a guest's given name. */
  requesterName: string;
  /** Requester phone when known (always set for guests). */
  requesterPhone: string | null;
  /** True for a ticket with no account behind it (مهمان). */
  isGuest: boolean;
  /** Requester's account id — null for guests. */
  userId: string | null;
  /** Preview of the newest message, trimmed for the list. */
  lastMessage: string;
  lastMessageAuthor: SupportAuthorType;
  /** Pre-formatted Jalali date of the newest message (hydration-safe). */
  lastMessageDate: string;
  lastMessageAt: string;
  /** Derived, never counted — see lib/support-status.ts. */
  unread: boolean;
  createdAt: string;
}

/** One message inside a ticket thread. */
export interface SupportMessageDTO {
  id: string;
  authorType: SupportAuthorType;
  authorName: string;
  body: string;
  /** Pre-formatted Jalali date + time, e.g. '۱۴۰۳/۱۲/۲۴ ۱۴:۳۰'. */
  date: string;
  createdAt: string;
}

/** A ticket with its full thread. */
export interface SupportTicketDetailDTO extends SupportTicketDTO {
  messages: SupportMessageDTO[];
  /** True when this ticket's messages still need the viewer's attention. */
  closedNote: string | null;
}

export interface SupportListFilters {
  status?: SupportTicketStatus | 'all';
  unreadOnly?: boolean;
  /** Free text over ticket id, subject, requester name and phone. */
  q?: string;
  page?: number;
}

export interface SupportListPage {
  tickets: SupportTicketDTO[];
  page: number;
  /** True when a full page came back — i.e. another page may exist. */
  hasMore: boolean;
}

const PAGE_SIZE = 20;

/** `TK-` + 5 digits, retried on the (very unlikely) unique collision. */
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
  // Practically unreachable; a timestamp suffix keeps it unique regardless.
  return `TK-${Date.now().toString().slice(-5)}`;
}

/** Trimmed one-line preview of a message body. */
function preview(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > 90 ? `${flat.slice(0, 90)}…` : flat;
}

/**
 * Jalali date AND time in one string. The date half reuses lib/format's
 * hand-rolled conversion (never Intl — a Node/browser ICU difference would
 * surface as a hydration mismatch); the time half is plain zero-padded digits.
 */
function faJalaliDateTime(value: Date): string {
  const clock = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  return `${faJalaliDate(value)} ${clock}`;
}

/** The columns every ticket projection needs. */
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

/** Maps a queried ticket row onto the DTO, deriving `unread` for `side`. */
function toTicketDTO(row: TicketRow, side: SupportAuthorType): SupportTicketDTO {
  const facts = {
    lastMessageAt: row.lastMessageAt,
    // The column keeps the legacy 'owner' word for the supporter while
    // SupportAuthorType speaks 'staff' (see prisma/schema.prisma + lib/support-status.ts).
    lastMessageAuthor:
      row.lastMessageAuthor === 'owner' || row.lastMessageAuthor === 'staff'
        ? ('staff' as const)
        : ('customer' as const),
    staffReadAt: row.staffReadAt,
    customerReadAt: row.customerReadAt,
  };
  const unread = side === 'staff' ? isUnreadForStaff(facts) : isUnreadForCustomer(facts);

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
    lastMessageAuthor: facts.lastMessageAuthor,
    lastMessageDate: faJalaliDate(row.lastMessageAt),
    lastMessageAt: row.lastMessageAt.toISOString(),
    unread,
    createdAt: row.createdAt.toISOString(),
  };
}

/** A customer's own tickets, newest activity first. */
export async function listTicketsForCustomer(userId: string): Promise<SupportTicketDTO[]> {
  const rows = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { lastMessageAt: 'desc' },
    select: TICKET_SELECT,
  });
  return rows.map((row) => toTicketDTO(row, 'customer'));
}

/** A guest's tickets — matched by the capability token in their cookie. */
export async function listTicketsForGuestToken(token: string): Promise<SupportTicketDTO[]> {
  if (!token) {
    return [];
  }
  const rows = await prisma.supportTicket.findMany({
    where: { guestToken: token },
    orderBy: { lastMessageAt: 'desc' },
    select: TICKET_SELECT,
  });
  return rows.map((row) => toTicketDTO(row, 'customer'));
}

/** The Prisma filter a ticket list/ count shares (status + free-text search). */
function ticketWhere(filters: SupportListFilters) {
  const q = filters.q?.trim();
  const status = filters.status && filters.status !== 'all' ? filters.status : null;
  const digits = q?.replace(/\D/g, '') ?? '';

  return {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { displayId: { contains: q } },
            { subject: { contains: q } },
            { guestName: { contains: q } },
            { guestPhone: { contains: digits || q } },
            { user: { is: { name: { contains: q } } } },
            { user: { is: { phone: { contains: digits || q } } } },
          ],
        }
      : {}),
  };
}

/** How many tickets match the filters, paging aside — the list's header count. */
export async function countTicketsForAdmin(filters: SupportListFilters): Promise<number> {
  if (filters.unreadOnly) {
    // Unread compares two columns, which SQLite cannot express in `where`, so
    // this one case counts in JS over the filtered rows.
    return countUnreadForStaff();
  }
  return prisma.supportTicket.count({ where: ticketWhere(filters) });
}

/**
 * The panel's ticket list with its filters. Paginated by `skip/take`; `hasMore`
 * comes from "did a full page come back" so no second count query is needed.
 * `unreadOnly` is applied in JS over the page's rows because "newer than
 * staffReadAt" compares two columns, which SQLite/Prisma cannot express in a
 * `where` clause.
 */
export async function listTicketsForAdmin(filters: SupportListFilters): Promise<SupportListPage> {
  const page = Math.max(1, filters.page ?? 1);
  const where = ticketWhere(filters);

  // Unread filtering narrows the result set, so it cannot ride on skip/take
  // without paging through the whole table — fetch a bounded window and page
  // in JS for that one case.
  if (filters.unreadOnly) {
    const rows = await prisma.supportTicket.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: PAGE_SIZE * page,
      select: TICKET_SELECT,
    });
    const unread = rows.map((row) => toTicketDTO(row, 'staff')).filter((ticket) => ticket.unread);
    return {
      tickets: unread.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      page,
      hasMore: unread.length > page * PAGE_SIZE,
    };
  }

  const rows = await prisma.supportTicket.findMany({
    where,
    orderBy: { lastMessageAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: TICKET_SELECT,
  });

  return {
    tickets: rows.map((row) => toTicketDTO(row, 'staff')),
    page,
    hasMore: rows.length === PAGE_SIZE,
  };
}

/** Count of tickets still waiting for a supporter — the sidebar badge. */
export async function countUnreadForStaff(): Promise<number> {
  const rows = await prisma.supportTicket.findMany({
    where: { status: { not: 'closed' }, lastMessageAuthor: 'customer' },
    select: {
      lastMessageAt: true,
      lastMessageAuthor: true,
      staffReadAt: true,
      customerReadAt: true,
    },
  });
  return rows.filter((row) =>
    isUnreadForStaff({
      lastMessageAt: row.lastMessageAt,
      lastMessageAuthor: 'customer',
      staffReadAt: row.staffReadAt,
      customerReadAt: row.customerReadAt,
    })
  ).length;
}

/** The two numbers the panel's notification bell shows. */
export interface SupportTicketStats {
  /** Newest message is the requester's and staff has not read it — «جدید». */
  unread: number;
  /** Status 'open', i.e. «در انتظار پاسخ» — the same status the filter uses. */
  open: number;
}

/**
 * The bell's counters. «باز» is deliberately the app's own `open` status, so
 * the number and the list it links to (`/support?status=open`) can never
 * disagree about what they are counting.
 */
export async function getTicketStatsForStaff(): Promise<SupportTicketStats> {
  const [unread, open] = await Promise.all([
    countUnreadForStaff(),
    prisma.supportTicket.count({ where: { status: 'open' } }),
  ]);
  return { unread, open };
}

/**
 * Loads one ticket for a viewer, enforcing ownership:
 * a customer sees only their own tickets, a guest only those behind their
 * cookie token, a supporter sees everything.
 * Returns null when the ticket exists but does not belong to the viewer — the
 * routes answer 404 either way, so ids cannot be probed.
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
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          authorSide: true,
          authorName: true,
          body: true,
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
    // A claimed token must match; an empty token never matches.
    const stored = await prisma.supportTicket.findUnique({
      where: { id },
      select: { guestToken: true },
    });
    if (!viewer.token || stored?.guestToken !== viewer.token) {
      return null;
    }
  }

  const side: SupportAuthorType = viewer.kind === 'staff' ? 'staff' : 'customer';
  const base = toTicketDTO(row as TicketRow, side);

  return {
    ...base,
    closedNote: base.status === 'closed' ? 'این تیکت بسته شده است.' : null,
    messages: row.messages.map((message) => ({
      id: message.id,
      authorType:
        message.authorSide === 'owner' || message.authorSide === 'staff' ? 'staff' : 'customer',
      authorName: message.authorName,
      body: message.body,
      date: faJalaliDateTime(message.createdAt),
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

/** Validates a message body. Returns a Persian error, or null when fine. */
function validateBody(body: unknown): string | null {
  if (typeof body !== 'string' || body.trim().length === 0) {
    return 'متن پیام را بنویسید.';
  }
  if (body.trim().length > MAX_BODY) {
    return `متن پیام نمی‌تواند بیشتر از ${MAX_BODY} نویسه باشد.`;
  }
  return null;
}

/** Opens a ticket for a signed-in customer, with its first message. */
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

  const ticket = await prisma.supportTicket.create({
    data: {
      displayId: await nextDisplayId(),
      userId: input.userId,
      subject,
      status: 'open',
      lastMessageAuthor: 'customer',
      messages: {
        create: {
          authorSide: 'customer',
          authorName: input.name,
          body: input.body.trim(),
        },
      },
    },
    select: { id: true, displayId: true },
  });

  return { ok: true, value: ticket };
}

/**
 * Opens a ticket for a guest. The name and phone are required up front (the
 * stated rule: a guest must identify themselves before chatting) and the
 * subject is derived from the first message, since a guest gets one field.
 * Returns the capability token that goes into the mnt_support cookie.
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

  const body = input.body.trim();
  const token = crypto.randomUUID();

  const ticket = await prisma.supportTicket.create({
    data: {
      displayId: await nextDisplayId(),
      guestName: name,
      guestPhone: input.phone,
      guestToken: token,
      subject:
        body.length > GUEST_SUBJECT_LENGTH ? `${body.slice(0, GUEST_SUBJECT_LENGTH)}…` : body,
      status: 'open',
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
 * Appends a message and moves the ticket along: the requester's message puts
 * it back to 'open' (waiting for an answer), a supporter's answer marks it
 * 'answered'. A closed ticket stays closed — reopening it is an explicit
 * action (setTicketStatus), so a reply never silently resurrects a finished
 * conversation.
 */
export async function addMessage(
  ticketId: string,
  author: { type: SupportAuthorType; name: string; id: string | null },
  body: string
): Promise<SupportResult<{ id: string }>> {
  const bodyError = validateBody(body);
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

  const now = new Date();
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.supportTicketMessage.create({
      data: {
        ticketId,
        // Stored the way every existing row is: 'owner' for the supporter.
        authorSide: author.type === 'staff' ? 'owner' : 'customer',
        authorName: author.name,
        body: body.trim(),
      },
      select: { id: true },
    });

    await tx.supportTicket.update({
      where: { id: ticketId },
      data: {
        lastMessageAt: now,
        lastMessageAuthor: author.type === 'staff' ? 'owner' : 'customer',
        // The side that just wrote has obviously read everything up to now.
        ...(author.type === 'staff' ? { staffReadAt: now } : { customerReadAt: now }),
        ...(ticket.status === 'closed'
          ? {}
          : { status: author.type === 'staff' ? 'answered' : 'open' }),
      },
    });

    return created;
  });

  return { ok: true, value: message };
}

/** Closes or reopens a ticket (supporter action). */
export async function setTicketStatus(
  id: string,
  status: SupportTicketStatus
): Promise<SupportResult<null>> {
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true } });
  if (!ticket) {
    return { ok: false, error: 'تیکت یافت نشد.' };
  }
  await prisma.supportTicket.update({ where: { id }, data: { status } });
  return { ok: true, value: null };
}

/** Records that one side has seen the thread — clears its unread marker. */
export async function markTicketRead(id: string, side: SupportAuthorType): Promise<void> {
  await prisma.supportTicket.updateMany({
    where: { id },
    data: side === 'staff' ? { staffReadAt: new Date() } : { customerReadAt: new Date() },
  });
}

/* ---------------------------------------------------------------------------
 * The supporter's context panel: the customer's latest order and wallet.
 * Read-only by design — answering a ticket must never move money.
 * ------------------------------------------------------------------------ */

export interface WalletLineDTO {
  id: string;
  /** Persian label from WALLET_TX_LABELS. */
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
  /** Latest order, or null when they have never ordered. */
  lastOrder: {
    displayId: string;
    date: string;
    amount: number;
    /** Raw status key — the panel maps it through STATUS_LABELS/COLORS. */
    status: string;
    trackingCode: string | null;
  } | null;
  /** Total orders on record. */
  orderCount: number;
  /** Newest few wallet movements. */
  walletLines: WalletLineDTO[];
  /** Tickets this customer has open right now. */
  openTicketCount: number;
}

/**
 * Everything a supporter needs to answer with context: who the customer is,
 * their latest order and their wallet state. Returns null for a guest ticket
 * (there is no account to look up).
 */
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

  const latest = orders[0] ?? null;

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
