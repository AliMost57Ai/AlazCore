/**
 * تحویل حضوری (pickup) — نقاط مراجعه، بازه‌های زمانی با ظرفیت، روزهای تعطیل،
 * رزرو روی سفارش و لیست مدیریت. رزرو = ستون‌های خود Order؛ لغو سفارش ظرفیت
 * را آزاد می‌کند (شمارش رزروهای هر بازه، سفارش‌های لغوشده را نمی‌بیند).
 *
 * گیت فیچر سمت لایسنس است (isInPersonDeliveryEnabled) — این ماژول فرض می‌کند
 * تماس‌گیرنده گیت را رد کرده؛ APIها هم دوباره چک می‌کنند.
 */

import prisma from './db';
import { faJalaliDate, toFaDigits } from './format';

export interface PickupSlotDTO {
  id: string;
  /** دقیقه از نیمه‌شب */
  startMinute: number;
  endMinute: number;
  capacity: number;
}

export interface PickupLocationDTO {
  id: string;
  title: string;
  address: string;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
  slots: PickupSlotDTO[];
}

export interface PickupHolidayDTO {
  id: string;
  /** ISO yyyy-mm-dd */
  date: string;
  title: string;
}

/** «۰۹:۰۰» از دقیقه نیمه‌شب — ارقام فارسی، جداکننده : لاتین. */
export function minuteLabel(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return toFaDigits(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
}

/** برچسب بازه «۰۹:۰۰ تا ۱۱:۰۰». */
export function slotLabel(slot: { startMinute: number; endMinute: number }): string {
  return `${minuteLabel(slot.startMinute)} تا ${minuteLabel(slot.endMinute)}`;
}

/** برچسب جلالی تاریخ ISO — فیلدهای خراب را بی‌صدا با «—» نشان می‌دهد. */
export function dateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : faJalaliDate(date);
}

function toSlotDTO(row: { id: string; startMinute: number; endMinute: number; capacity: number }) {
  return {
    id: row.id,
    startMinute: row.startMinute,
    endMinute: row.endMinute,
    capacity: row.capacity,
  };
}

// ---------------------------------------------------------------------------
// مدیریت نقاط و بازه‌ها (مالک/کارشناس دارای دسترسی)
// ---------------------------------------------------------------------------

export async function listPickupLocations(): Promise<PickupLocationDTO[]> {
  const rows = await prisma.pickupLocation.findMany({
    orderBy: { createdAt: 'asc' },
    include: { slots: { orderBy: { startMinute: 'asc' } } },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    isActive: row.isActive,
    slots: row.slots.map(toSlotDTO),
  }));
}

export interface PickupSlotInput {
  startMinute: number;
  endMinute: number;
  capacity: number;
}

export interface PickupLocationInput {
  title: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
  isActive: boolean;
  slots: PickupSlotInput[];
}

export function validateLocationInput(input: PickupLocationInput): string | null {
  if (input.title.trim().length < 2 || input.title.trim().length > 80) {
    return 'عنوان نقطه باید بین ۲ تا ۸۰ نویسه باشد.';
  }
  if (input.address.trim().length < 10 || input.address.trim().length > 500) {
    return 'نشانی باید بین ۱۰ تا ۵۰۰ نویسه باشد.';
  }
  if (
    input.lat !== null &&
    input.lat !== undefined &&
    (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90)
  ) {
    return 'عرض جغرافیایی نامعتبر است.';
  }
  if (
    input.lng !== null &&
    input.lng !== undefined &&
    (!Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180)
  ) {
    return 'طول جغرافیایی نامعتبر است.';
  }
  if (input.slots.length === 0) {
    return 'حداقل یک بازه زمانی تعریف کنید.';
  }
  if (input.slots.length > 20) {
    return 'بیشتر از ۲۰ بازه زمانی مجاز نیست.';
  }
  for (const slot of input.slots) {
    if (
      !Number.isInteger(slot.startMinute) ||
      slot.startMinute < 0 ||
      slot.startMinute > 1439 ||
      !Number.isInteger(slot.endMinute) ||
      slot.endMinute < 1 ||
      slot.endMinute > 1440 ||
      slot.endMinute <= slot.startMinute
    ) {
      return 'بازه زمانی نامعتبر است (پایان باید بعد از شروع باشد).';
    }
    if (!Number.isInteger(slot.capacity) || slot.capacity < 1 || slot.capacity > 999) {
      return 'ظرفیت هر بازه باید عددی بین ۱ تا ۹۹۹ باشد.';
    }
  }
  return null;
}

/** ساخت/ویرایش نقطه با بازه‌هایش — بازه‌ها هر بار کامل جایگزین می‌شوند. */
export async function savePickupLocation(
  id: string | null,
  input: PickupLocationInput
): Promise<{ location: PickupLocationDTO } | { error: string }> {
  const problem = validateLocationInput(input);
  if (problem) {
    return { error: problem };
  }

  const data = {
    title: input.title.trim(),
    address: input.address.trim(),
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    isActive: input.isActive,
  };

  const row = await prisma.$transaction(async (tx) => {
    if (id) {
      const existing = await tx.pickupLocation.findUnique({ where: { id } });
      if (!existing) {
        return null;
      }
      await tx.pickupSlot.deleteMany({ where: { locationId: id } });
      return tx.pickupLocation.update({
        where: { id },
        data: {
          ...data,
          slots: { create: input.slots },
        },
        include: { slots: { orderBy: { startMinute: 'asc' } } },
      });
    }
    return tx.pickupLocation.create({
      data: { ...data, slots: { create: input.slots } },
      include: { slots: { orderBy: { startMinute: 'asc' } } },
    });
  });

  if (!row) {
    return { error: 'نقطه تحویل یافت نشد.' };
  }
  return {
    location: {
      id: row.id,
      title: row.title,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      isActive: row.isActive,
      slots: row.slots.map(toSlotDTO),
    },
  };
}

export async function deletePickupLocation(id: string): Promise<{ ok: true } | { error: string }> {
  const existing = await prisma.pickupLocation.findUnique({ where: { id } });
  if (!existing) {
    return { error: 'نقطه تحویل یافت نشد.' };
  }
  await prisma.pickupLocation.delete({ where: { id } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// روزهای تعطیل
// ---------------------------------------------------------------------------

export async function listPickupHolidays(): Promise<PickupHolidayDTO[]> {
  const rows = await prisma.pickupHoliday.findMany({ orderBy: { date: 'asc' } });
  return rows.map((row) => ({ id: row.id, date: row.date, title: row.title }));
}

/** تاریخ فقط به شکل ISO yyyy-mm-dd پذیرفته می‌شود. */
function isIsoDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
  );
}

export async function addPickupHoliday(
  date: string,
  title: string
): Promise<{ holiday: PickupHolidayDTO } | { error: string }> {
  if (!isIsoDate(date)) {
    return { error: 'تاریخ تعطیل نامعتبر است.' };
  }
  try {
    const row = await prisma.pickupHoliday.create({
      data: { date, title: title.trim().slice(0, 120) },
    });
    return { holiday: { id: row.id, date: row.date, title: row.title } };
  } catch {
    return { error: 'این تاریخ قبلاً تعطیل ثبت شده است.' };
  }
}

export async function removePickupHoliday(id: string): Promise<{ ok: true } | { error: string }> {
  const existing = await prisma.pickupHoliday.findUnique({ where: { id } });
  if (!existing) {
    return { error: 'روز تعطیل یافت نشد.' };
  }
  await prisma.pickupHoliday.delete({ where: { id } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// دسترس‌پذیری مشتری — نقاط فعال + ظرفیت بازه‌ها برای ۷ روز آینده
// ---------------------------------------------------------------------------

export interface PickupDayAvailability {
  /** ISO yyyy-mm-dd */
  date: string;
  /** برچسب جلالی روز */
  dateLabel: string;
  isHoliday: boolean;
  isToday: boolean;
  slots: {
    id: string;
    label: string;
    capacity: number;
    reserved: number;
    remaining: number;
    /** بازه گذشته امروز — انتخاب نامعتبر */
    isPast: boolean;
  }[];
}

/** تاریخ امروز به ISO محلی (نه UTC — رزرو باید با ساعت فروشگاه یکی باشد). */
export function todayIso(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** ظرفیت باقی‌مانده هر بازه در یک روز — رزرو = سفارش‌های لغو‌نشده همان بازه. */
async function reservedCounts(locationId: string, date: string) {
  const rows = await prisma.order.groupBy({
    by: ['pickupSlotId'],
    where: {
      pickupLocationId: locationId,
      pickupDate: date,
      pickupSlotId: { not: null },
      status: { not: 'cancelled' },
    },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.pickupSlotId) {
      map.set(row.pickupSlotId, row._count._all);
    }
  }
  return map;
}

/** دسترس‌پذیری یک نقطه از امروز تا days روز بعد — تعطیل‌ها و ظرفیت‌ها اعمال‌شده. */
export async function pickupAvailability(
  locationId: string,
  days = 7
): Promise<{ days: PickupDayAvailability[] } | { error: string }> {
  const location = await prisma.pickupLocation.findUnique({
    where: { id: locationId },
    include: { slots: { orderBy: { startMinute: 'asc' } } },
  });
  if (!location || !location.isActive) {
    return { error: 'نقطه تحویل در دسترس نیست.' };
  }

  const today = todayIso();
  const dates = Array.from({ length: days }, (_, index) => addDaysIso(today, index));
  const holidays = await prisma.pickupHoliday.findMany({
    where: { date: { in: dates } },
    select: { date: true },
  });
  const holidaySet = new Set(holidays.map((row) => row.date));

  const result: PickupDayAvailability[] = [];
  for (const date of dates) {
    const isHoliday = holidaySet.has(date);
    const reserved = isHoliday ? new Map<string, number>() : await reservedCounts(locationId, date);
    const nowMinutes = date === today ? new Date().getHours() * 60 + new Date().getMinutes() : -1;
    result.push({
      date,
      dateLabel: dateLabel(date),
      isHoliday,
      isToday: date === today,
      slots: location.slots.map((slot) => {
        const taken = reserved.get(slot.id) ?? 0;
        return {
          id: slot.id,
          label: slotLabel(slot),
          capacity: slot.capacity,
          reserved: taken,
          remaining: Math.max(slot.capacity - taken, 0),
          isPast: date === today && slot.endMinute <= nowMinutes,
        };
      }),
    });
  }
  return { days: result };
}

/** اعتبارسنجی رزرو مشتری پیش از ثبت — پیام خطای فارسی برمی‌گرداند. */
export async function validatePickupReservation(input: {
  locationId: string;
  slotId: string;
  date: string;
}): Promise<
  | {
      location: { id: string; title: string; address: string };
      slot: { startMinute: number; endMinute: number };
    }
  | { error: string }
> {
  if (!isIsoDate(input.date)) {
    return { error: 'تاریخ تحویل نامعتبر است.' };
  }
  const today = todayIso();
  const horizon = addDaysIso(today, 6);
  if (input.date < today || input.date > horizon) {
    return { error: 'رزرو فقط برای هفت روز آینده امکان‌پذیر است.' };
  }

  const location = await prisma.pickupLocation.findUnique({
    where: { id: input.locationId },
    include: { slots: true },
  });
  if (!location || !location.isActive) {
    return { error: 'نقطه تحویل در دسترس نیست.' };
  }
  const slot = location.slots.find((row) => row.id === input.slotId);
  if (!slot) {
    return { error: 'بازه زمانی یافت نشد.' };
  }

  const holiday = await prisma.pickupHoliday.findUnique({ where: { date: input.date } });
  if (holiday) {
    return { error: `روز انتخابی تعطیل است${holiday.title ? ` (${holiday.title})` : ''}.` };
  }

  if (input.date === today) {
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    if (slot.endMinute <= nowMinutes) {
      return { error: 'این بازه زمانی گذشته است.' };
    }
  }

  const reserved = await reservedCounts(input.locationId, input.date);
  const taken = reserved.get(slot.id) ?? 0;
  if (taken >= slot.capacity) {
    return { error: 'ظرفیت این بازه زمانی پر شده است؛ بازه دیگری انتخاب کنید.' };
  }

  return {
    location: { id: location.id, title: location.title, address: location.address },
    slot: { startMinute: slot.startMinute, endMinute: slot.endMinute },
  };
}

// ---------------------------------------------------------------------------
// لیست مدیریت سفارش‌های تحویل حضوری + شمارنده اعلان‌ها + تحویل
// ---------------------------------------------------------------------------

export type PickupOrderFilter = 'today' | 'upcoming' | 'delivered' | 'all';

export interface PickupOrderDTO {
  id: string;
  displayId: string;
  customer: string;
  customerPhone: string | null;
  date: string;
  amount: number;
  status: string;
  locationId: string;
  locationTitle: string;
  locationAddress: string;
  slotLabel: string;
  pickupDate: string;
  pickupDateLabel: string;
  isToday: boolean;
  /** بازه زمانی رزروشده — برای پیش‌فرض مودال تغییر برنامه. */
  pickupSlotId: string | null;
  /** اقلام سفارش — آکاردئون جزئیات جدول تحویل حضوری. */
  items: { name: string; qty: number; unitPrice: number }[];
  itemsTotal: number;
  /** آخرین تغییر برنامه تحویل — علت + زمان (null = تغییر نکرده). */
  changeNote: string | null;
  changeAt: string | null;
}

/** لیست سفارش‌های تحویل حضوری با فیلتر و جستجو (شناسه/مشتری/موبایل/نقطه).
 *  `date` اختیاری — روز مشخص تحویل (ISO) که بر فیلتر «امروز» اولویت دارد. */
export async function pickupOrdersList(
  filter: PickupOrderFilter = 'all',
  search?: string,
  date?: string
): Promise<PickupOrderDTO[]> {
  const today = todayIso();
  const where: Record<string, unknown> = {
    pickupSlotId: { not: null },
    pickupLocationId: { not: null },
    pickupDate: { not: null },
  };
  const selectedDate = isIsoDate(date ?? '') ? (date as string) : null;
  if (selectedDate) {
    where.pickupDate = selectedDate;
  } else if (filter === 'today') {
    where.pickupDate = today;
    where.status = { not: 'cancelled' };
  } else if (filter === 'upcoming') {
    where.pickupDate = { gte: today };
    where.status = { in: ['paid', 'boxing', 'posted', 'shipped', 'pending'] };
  } else if (filter === 'delivered') {
    where.status = 'delivered';
  }

  const trimmed = search?.trim();
  if (trimmed) {
    const { fromFaDigits } = await import('./format');
    const normalized = fromFaDigits(trimmed);
    const users = await prisma.user.findMany({
      where: { phone: { contains: normalized } },
      select: { id: true },
    });
    const or: Record<string, unknown>[] = [
      { displayId: { contains: normalized } },
      { customer: { contains: trimmed } },
      // جستجو در اقلام کالا — itemsJson نام کالاها را نگه می‌دارد.
      { itemsJson: { contains: trimmed } },
    ];
    const locations = await prisma.pickupLocation.findMany({
      where: { title: { contains: trimmed } },
      select: { id: true },
    });
    if (locations.length > 0) {
      or.push({ pickupLocationId: { in: locations.map((row) => row.id) } });
    }
    if (users.length > 0) {
      or.push({ userId: { in: users.map((row) => row.id) } });
    }
    where.OR = or;
  }

  const rows = await prisma.order.findMany({
    where,
    orderBy: [{ pickupDate: 'asc' }, { displayId: 'desc' }],
    take: 300,
    // رزروِ ردیف‌های قدیمی ممکن است نقطه/بازه حذف‌شده داشته باشد — join نرم.
  });

  // موبایل مشتری — userId ستون خام است (بدون relation)، پس یک کوئری دسته‌ای.
  const userIds = [...new Set(rows.map((row) => row.userId).filter((id): id is string => !!id))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, phone: true },
  });
  const phoneByUser = new Map(users.map((user) => [user.id, user.phone]));

  const locationIds = [
    ...new Set(rows.map((row) => row.pickupLocationId).filter((id): id is string => !!id)),
  ];
  const locations = await prisma.pickupLocation.findMany({
    where: { id: { in: locationIds } },
    select: { id: true, title: true, address: true },
  });
  const locationMap = new Map(locations.map((row) => [row.id, row]));
  const slotIds = [
    ...new Set(rows.map((row) => row.pickupSlotId).filter((id): id is string => !!id)),
  ];
  const slots = await prisma.pickupSlot.findMany({ where: { id: { in: slotIds } } });
  const slotMap = new Map(slots.map((row) => [row.id, row]));

  return rows.map((row) => {
    const location = row.pickupLocationId ? locationMap.get(row.pickupLocationId) : undefined;
    const slot = row.pickupSlotId ? slotMap.get(row.pickupSlotId) : undefined;
    const items = row.itemsJson ? parseOrderItemsSafe(row.itemsJson) : [];
    return {
      id: row.id,
      displayId: row.displayId,
      customer: row.customer,
      customerPhone: (row.userId && phoneByUser.get(row.userId)) || null,
      date: row.date,
      amount: row.amount,
      status: row.status,
      locationId: row.pickupLocationId ?? '',
      locationTitle: location?.title ?? '—',
      locationAddress: location?.address ?? '',
      slotLabel: slot ? slotLabel(slot) : '—',
      pickupDate: row.pickupDate ?? '',
      pickupDateLabel: row.pickupDate ? dateLabel(row.pickupDate) : '—',
      isToday: row.pickupDate === today,
      pickupSlotId: row.pickupSlotId,
      items,
      itemsTotal: items.reduce((sum, line) => sum + line.qty * line.unitPrice, 0),
      changeNote: row.pickupChangeNote,
      changeAt: row.pickupChangeAt ? changeAtLabel(row.pickupChangeAt) : null,
    };
  });
}

/** برچسب تاریخ+ساعت تغییر برنامه — مثلاً «۱۴۰۵/۰۷/۱۱ ۱۴:۳۰». */
function changeAtLabel(at: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${faJalaliDate(at)} ${toFaDigits(`${pad(at.getHours())}:${pad(at.getMinutes())}`)}`;
}

/** پارس مقاوم itemsJson — ردیف خراب = فهرست خالی. */
function parseOrderItemsSafe(json: string): { name: string; qty: number; unitPrice: number }[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (line): line is Record<string, unknown> =>
          typeof line === 'object' &&
          line !== null &&
          typeof (line as { name?: unknown }).name === 'string'
      )
      .map((line) => ({
        name: String(line.name),
        qty: typeof line.qty === 'number' && line.qty > 0 ? Math.floor(line.qty) : 0,
        unitPrice: typeof line.unitPrice === 'number' && line.unitPrice >= 0 ? line.unitPrice : 0,
      }))
      .filter((line) => line.qty > 0);
  } catch {
    return [];
  }
}

/** شمارنده اعلان‌ها/باکس‌ها — رزروهای فعال (پرداخت‌شده، منتظر مراجعه) و تحویل‌شده‌ها. */
export async function pickupCounts(): Promise<{ reserved: number; delivered: number }> {
  const [reserved, delivered] = await Promise.all([
    prisma.order.count({
      where: {
        pickupSlotId: { not: null },
        status: { in: ['paid', 'boxing', 'posted', 'shipped'] },
      },
    }),
    prisma.order.count({
      where: {
        pickupSlotId: { not: null },
        status: 'delivered',
      },
    }),
  ]);
  return { reserved, delivered };
}

export interface ReschedulePickupResult {
  ok: true;
  dateLabel: string;
  slotLabel: string;
}

/**
 * تغییر تاریخ/بازه تحویل حضوری توسط مالک — با علت. اعتبارسنجی: بازه متعلق به
 * همان نقطه، روز غیرتعطیل/گذشته، ظرفیت باز (رزروِ خودِ سفارش در شمارش بی‌اثر).
 * علت در pickupChangeNote ثبت و زمان تغییر pickupChangeAt ست می‌شود.
 */
export async function reschedulePickup(
  orderId: string,
  input: { date: string; slotId: string; note: string }
): Promise<ReschedulePickupResult | { error: string }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.pickupLocationId || !order.pickupSlotId) {
    return { error: 'سفارش تحویل حضوری یافت نشد.' };
  }
  if (order.status === 'delivered' || order.status === 'cancelled') {
    return { error: 'سفارش در وضعیت نهایی است و برنامه تحویلش تغییر نمی‌کند.' };
  }
  if (!isIsoDate(input.date)) {
    return { error: 'تاریخ تحویل نامعتبر است.' };
  }
  const note = input.note.trim();
  if (note.length < 3 || note.length > 300) {
    return { error: 'علت تغییر را بین ۳ تا ۳۰۰ نویسه بنویسید.' };
  }

  const today = todayIso();
  if (input.date < today) {
    return { error: 'تاریخ جدید نمی‌تواند در گذشته باشد.' };
  }
  const horizon = addDaysIso(today, 30);
  if (input.date > horizon) {
    return { error: 'تاریخ جدید حداکثر ۳۰ روز آینده است.' };
  }
  const holiday = await prisma.pickupHoliday.findUnique({ where: { date: input.date } });
  if (holiday) {
    return { error: `روز انتخابی تعطیل است${holiday.title ? ` (${holiday.title})` : ''}.` };
  }

  const slot = await prisma.pickupSlot.findUnique({ where: { id: input.slotId } });
  if (!slot || slot.locationId !== order.pickupLocationId) {
    return { error: 'بازه زمانی متعلق به نقطه تحویل این سفارش نیست.' };
  }

  if (input.date === today) {
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    if (slot.endMinute <= nowMinutes) {
      return { error: 'این بازه زمانی امروز گذشته است.' };
    }
  }

  // ظرفیت: رزروهای همان بازه/روز، منهای خودِ این سفارش (تغییر در جای همان).
  const reserved = await reservedCounts(order.pickupLocationId, input.date);
  const selfOccupying = order.pickupDate === input.date && order.pickupSlotId === input.slotId;
  const taken = (reserved.get(slot.id) ?? 0) - (selfOccupying ? 1 : 0);
  if (taken >= slot.capacity) {
    return { error: 'ظرفیت این بازه زمانی پر شده است؛ بازه دیگری انتخاب کنید.' };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      pickupDate: input.date,
      pickupSlotId: input.slotId,
      pickupChangeNote: note,
      pickupChangeAt: new Date(),
    },
  });

  return {
    ok: true,
    dateLabel: dateLabel(input.date),
    slotLabel: slotLabel(slot),
  };
}

/** ثبت تحویل حضوری — سفارش پرداخت‌شدهِ رزروشده را «تحویل شده» می‌کند. */
export async function markPickupDelivered(
  orderId: string
): Promise<{ ok: true } | { error: string }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.pickupSlotId) {
    return { error: 'سفارش تحویل حضوری یافت نشد.' };
  }
  if (order.status === 'delivered') {
    return { error: 'این سفارش قبلاً تحویل شده است.' };
  }
  if (order.status === 'cancelled') {
    return { error: 'سفارش لغوشده قابل تحویل نیست.' };
  }
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'delivered', deliveredAt: new Date() },
  });
  return { ok: true };
}
