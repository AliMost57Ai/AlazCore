/**
 * مرجوعی کالا — منطق سرورِ درخواست مرجوعی: اهلیت سفارش، ثبت درخواست با
 * اسنپ‌شات اقلام، بررسی/تایید مالک (روش برگشت + پرداخت‌کننده هزینه ارسال)،
 * ثبت مدارک ارسال مشتری، دریافت کالا و تسویه به کیف پول.
 *
 * قواعد ثابت این ماژول:
 *  - مبالغ همیشه سمت سرور و authoritative محاسبه می‌شوند (کلاینت فقط
 *    productId/variantId/qty می‌فرستد)؛ سهم بازگشتی هر قلم تناسبی از مبلغ
 *    پرداختیِ کالاها (amount − discountAmount) است و از سقف تعهدِ
 *    درخواست‌های قبلی همان سفارش عبور نمی‌کند.
 *  - هر تغییر وضعیت یک ReturnEvent می‌نویسد — منبع تایم‌لاین دو طرف.
 *  - سفارشِ تحویل حضوری فقط با مراجعه حضوری مرجوع می‌شود.
 *  - موجودیِ کالای بازگشتی هنگام تسویه برمی‌گردد (قرینه کسر موجودیِ
 *    placeOrder: فقط variant وقتی variantId دارد، وگرنه product).
 */

import prisma from './db';
import { getOrdersReturnState } from './return-eligibility';
import {
  computeRefundAmount,
  RETURN_METHOD_LABELS,
  RETURN_REASON_LABELS,
  RETURN_SHIPPING_PAYER_LABELS,
  type ReturnLine,
  type ReturnMethod,
  type ReturnShippingPayer,
  type ReturnStatus,
} from './return-status';
import { getAppSettings } from './settings';
import { parseItems } from './shop-orders';
import { creditWallet } from './wallet';

/** حداکثر عکس برای هر درخواست مرجوعی. */
export const MAX_RETURN_IMAGES = 3;

/** حداکثر هزینه ارسال برگشت اعلامی مشتری (تومان). */
export const MAX_SHIPPING_COST = 50_000_000;

/** قالب مسیر عکس آپلودشده — خروجی /api/account/returns/upload. */
const IMAGE_PATH_RE = /^uploads\/[0-9a-f-]{36}\.(png|jpg|webp|avif)$/;

/** کلید یکتای قلم در itemsJson — خط‌های تکراری در سبد ادغام می‌شوند. */
function lineKey(productId: string, variantId: string | null | undefined): string {
  return `${productId}|${variantId ?? ''}`;
}

/** Parses a return request's itemsJson defensively — malformed rows dropped. */
export function parseReturnLines(json: string): ReturnLine[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is ReturnLine =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as ReturnLine).productId === 'string' &&
        typeof (item as ReturnLine).name === 'string' &&
        typeof (item as ReturnLine).qty === 'number' &&
        typeof (item as ReturnLine).unitPrice === 'number'
    );
  } catch {
    return [];
  }
}

/** Parses a return request's imagesJson — only /api/files paths survive. */
export function parseReturnImages(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is string => typeof item === 'string' && IMAGE_PATH_RE.test(item)
    );
  } catch {
    return [];
  }
}

/** `RET-` + 5 digits, retried on the (very unlikely) unique collision. */
async function nextReturnDisplayId(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `RET-${String(10_000 + Math.floor(Math.random() * 90_000))}`;
    const taken = await prisma.returnRequest.findUnique({
      where: { displayId: candidate },
      select: { id: true },
    });
    if (!taken) {
      return candidate;
    }
  }
  return `RET-${Date.now().toString().slice(-5)}`;
}

/** جمع تعهد اقلام/مبلغ از درخواست‌های قبلی همین سفارش (رد/لغوشده‌ها منهای یک ردیف اختیاری). */
async function committedState(
  orderId: string,
  excludeReturnId?: string
): Promise<{ qty: Map<string, number>; amount: number }> {
  const rows = await prisma.returnRequest.findMany({
    where: {
      orderId,
      status: { notIn: ['rejected', 'cancelled'] },
      ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}),
    },
    select: { id: true, itemsJson: true, refundItemsAmount: true },
  });
  const qty = new Map<string, number>();
  let amount = 0;
  for (const row of rows) {
    amount += row.refundItemsAmount;
    for (const line of parseReturnLines(row.itemsJson)) {
      const key = lineKey(line.productId, line.variantId);
      qty.set(key, (qty.get(key) ?? 0) + line.qty);
    }
  }
  return { qty, amount };
}

/**
 * اقلام قابل مرجوع یک سفارش — با سقفِ باقی‌مانده هر قلم (سفارش منهای تعهد
 * درخواست‌های قبلی) برای فرم درخواست مشتری.
 */
export async function orderReturnableLines(orderId: string): Promise<{
  lines: Array<ReturnLine & { remaining: number }>;
  paidGoodsTotal: number;
  committedAmount: number;
}> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return { lines: [], paidGoodsTotal: 0, committedAmount: 0 };
  }
  const orderLines = parseItems(order.itemsJson);
  const committed = await committedState(orderId);
  const lines = orderLines.map((line) => {
    const key = lineKey(line.productId, line.variantId);
    return {
      productId: line.productId,
      variantId: line.variantId ?? null,
      name: line.name,
      qty: line.qty,
      unitPrice: line.unitPrice,
      remaining: line.qty - (committed.qty.get(key) ?? 0),
    };
  });
  return {
    lines,
    paidGoodsTotal: Math.max(order.amount - order.discountAmount, 0),
    committedAmount: committed.amount,
  };
}

export type CreateReturnResult =
  | { ok: true; displayId: string; refundAmount: number }
  | { error: string };

export interface CreateReturnInput {
  userId: string;
  userName: string;
  orderId: string;
  reasonKind: string;
  reason: string;
  images: string[];
  items: { productId: string; variantId?: string | null; qty: number }[];
}

/**
 * ثبت درخواست مرجوعی توسط مشتری — اهلیت (تحویل‌شده + ویندو + بدون درخواست
 * فعال) و سقف تعدادِ هر قلم سمت سرور چک می‌شود و اسنپ‌شات اقلام/مبلغ در
 * همان لحظه قفل می‌شود.
 */
export async function createReturnRequest(input: CreateReturnInput): Promise<CreateReturnResult> {
  if (!Object.hasOwn(RETURN_REASON_LABELS, input.reasonKind)) {
    return { error: 'علت مرجوعی انتخاب‌شده معتبر نیست.' };
  }
  const reason = (input.reason ?? '').trim();
  if (reason.length < 5 || reason.length > 1000) {
    return { error: 'توضیح علت مرجوعی باید بین ۵ تا ۱۰۰۰ نویسه باشد.' };
  }
  const images = Array.isArray(input.images) ? input.images : [];
  if (images.length > MAX_RETURN_IMAGES) {
    return { error: `حداکثر ${MAX_RETURN_IMAGES} تصویر مجاز است.` };
  }
  if (images.some((path) => typeof path !== 'string' || !IMAGE_PATH_RE.test(path))) {
    return { error: 'آدرس تصاویر ارسالی نامعتبر است.' };
  }

  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order || order.userId !== input.userId) {
    return { error: 'سفارش یافت نشد.' };
  }
  if (order.status !== 'delivered') {
    return { error: 'فقط سفارش‌های تحویل‌شده قابل مرجوع هستند.' };
  }

  const state = await getOrdersReturnState([order]).then((map) => map.get(order.id));
  if (!state?.returnEnabled) {
    return { error: 'امکان مرجوعی کالا در این فروشگاه فعال نیست.' };
  }
  if (state.windowDays <= 0 || !state.windowEndsAt || state.windowEndsAt.getTime() < Date.now()) {
    return { error: 'مهلت مرجوعی این سفارش تمام شده است.' };
  }
  if (state.hasActiveRequest) {
    return { error: 'برای این سفارش یک درخواست مرجوعی فعال وجود دارد.' };
  }

  const orderLines = parseItems(order.itemsJson);
  const committed = await committedState(order.id);

  // تطبیق اقلام درخواستی با اقلام سفارش + سقف تعدادِ تعهدشده.
  const selected = new Map<string, ReturnLine>();
  for (const item of input.items) {
    if (
      !item ||
      typeof item.productId !== 'string' ||
      !Number.isInteger(item.qty) ||
      item.qty < 1
    ) {
      return { error: 'اقلام انتخاب‌شده نامعتبر است.' };
    }
    const key = lineKey(item.productId, item.variantId);
    const line = orderLines.find((row) => lineKey(row.productId, row.variantId) === key);
    if (!line) {
      return { error: 'یکی از اقلام انتخاب‌شده در این سفارش نیست.' };
    }
    const available = line.qty - (committed.qty.get(key) ?? 0);
    const wanted = (selected.get(key)?.qty ?? 0) + item.qty;
    if (wanted > available) {
      return {
        error:
          available > 0
            ? `تعداد قابل مرجوع برای «${line.name}» حداکثر ${available} عدد است.`
            : `برای «${line.name}» تعداد قابل مرجوعی باقی نمانده است.`,
      };
    }
    selected.set(key, {
      productId: line.productId,
      variantId: line.variantId ?? null,
      name: line.name,
      qty: wanted,
      unitPrice: line.unitPrice,
    });
  }
  const lines = [...selected.values()];
  if (lines.length === 0) {
    return { error: 'حداقل یک قلم را برای مرجوع انتخاب کنید.' };
  }

  const paidGoodsTotal = Math.max(order.amount - order.discountAmount, 0);
  const refund = Math.min(
    computeRefundAmount(lines, orderLines, paidGoodsTotal),
    Math.max(paidGoodsTotal - committed.amount, 0)
  );
  if (refund <= 0) {
    return { error: 'مبلغ قابل بازگشت برای اقلام انتخابی صفر است.' };
  }

  const displayId = await nextReturnDisplayId();
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.returnRequest.create({
      data: {
        displayId,
        orderId: order.id,
        userId: input.userId,
        status: 'requested',
        reasonKind: input.reasonKind,
        reason,
        imagesJson: JSON.stringify(images),
        itemsJson: JSON.stringify(lines),
        refundItemsAmount: refund,
      },
    });
    await tx.returnEvent.create({
      data: {
        returnRequestId: row.id,
        toStatus: 'requested',
        message: 'درخواست مرجوعی ثبت شد و در انتظار بررسی فروشگاه است.',
        actorRole: 'customer',
        actorName: input.userName,
      },
    });
    return row;
  });

  return { ok: true, displayId: created.displayId, refundAmount: refund };
}

export type StaffActionResult = { ok: true } | { error: string };

export interface ReviewInput {
  returnId: string;
  staffName: string;
  action: 'approve' | 'reject';
  returnMethod?: string;
  shippingPayer?: string;
  approvalNote?: string;
  rejectReason?: string;
}

/**
 * بررسی درخواست توسط کاربر بک‌آفیس: تایید (با تعیین روش برگشت و پرداخت‌کننده
 * هزینه ارسال — سفارش تحویل حضوری همیشه «مراجعه حضوری») یا رد با ذکر علت.
 * با تایید، مبلغ بازگشتی اقلام نهایی و قفل می‌شود.
 */
export async function reviewReturnRequest(input: ReviewInput): Promise<StaffActionResult> {
  const row = await prisma.returnRequest.findUnique({
    where: { id: input.returnId },
    include: { order: true },
  });
  if (!row) {
    return { error: 'درخواست مرجوعی یافت نشد.' };
  }
  if (row.status !== 'requested') {
    return { error: 'فقط درخواست‌های «ثبت شده» قابل بررسی هستند.' };
  }

  if (input.action === 'reject') {
    const rejectReason = (input.rejectReason ?? '').trim();
    if (rejectReason.length < 3 || rejectReason.length > 500) {
      return { error: 'علت رد درخواست را بنویسید (۳ تا ۵۰۰ نویسه).' };
    }
    await prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id: row.id },
        data: { status: 'rejected', rejectReason, rejectedAt: new Date() },
      });
      await tx.returnEvent.create({
        data: {
          returnRequestId: row.id,
          toStatus: 'rejected',
          message: `درخواست مرجوعی رد شد — علت: ${rejectReason}`,
          actorRole: 'staff',
          actorName: input.staffName,
        },
      });
    });
    return { ok: true };
  }

  // --- تایید ---
  const settings = await getAppSettings();
  const isPickupOrder = Boolean(row.order.pickupSlotId);

  let method: ReturnMethod = 'self_ship';
  if (isPickupOrder) {
    // تحویل حضوری بوده — برگشت هم حضوری است؛ انتخابِ دیگر پذیرفته نیست.
    method = 'in_person';
  } else if (
    input.returnMethod === 'shop_courier' ||
    input.returnMethod === 'in_person' ||
    input.returnMethod === 'self_ship'
  ) {
    method = input.returnMethod;
  }
  if (method === 'shop_courier' && !settings.returnCourierEnabled) {
    return { error: 'گزینه «پیک مرجوعی» در تنظیمات فروشگاه فعال نیست.' };
  }
  if (method === 'in_person' && !isPickupOrder) {
    return { error: 'روش «مراجعه حضوری» فقط برای سفارش‌های تحویل حضوری است.' };
  }

  const payer: ReturnShippingPayer =
    input.shippingPayer === 'shop' || input.shippingPayer === 'customer'
      ? input.shippingPayer
      : settings.returnDefaultShipPayer === 'shop'
        ? 'shop'
        : 'customer';

  // قفل مبلغ نهایی — همان فرمول ثبت، با سقف تعهد درخواست‌های دیگر.
  const orderLines = parseItems(row.order.itemsJson);
  const committed = await committedState(row.orderId, row.id);
  const lines = parseReturnLines(row.itemsJson);
  const paidGoodsTotal = Math.max(row.order.amount - row.order.discountAmount, 0);
  const refund = Math.min(
    computeRefundAmount(lines, orderLines, paidGoodsTotal),
    Math.max(paidGoodsTotal - committed.amount, 0)
  );
  if (refund <= 0) {
    return { error: 'مبلغ قابل بازگشت برای اقلام این درخواست صفر است.' };
  }

  const note = (input.approvalNote ?? '').trim().slice(0, 500);
  const methodLabel = RETURN_METHOD_LABELS[method];
  const message =
    method === 'self_ship'
      ? `درخواست تایید شد — روش برگشت: ${methodLabel}؛ پرداخت‌کننده هزینه ارسال: ${RETURN_SHIPPING_PAYER_LABELS[payer]}`
      : `درخواست تایید شد — روش برگشت: ${methodLabel}`;

  await prisma.$transaction(async (tx) => {
    await tx.returnRequest.update({
      where: { id: row.id },
      data: {
        status: 'approved',
        returnMethod: method,
        shippingPayer: method === 'self_ship' ? payer : null,
        approvalNote: note || null,
        refundItemsAmount: refund,
        approvedAt: new Date(),
      },
    });
    await tx.returnEvent.create({
      data: {
        returnRequestId: row.id,
        toStatus: 'approved',
        message,
        actorRole: 'staff',
        actorName: input.staffName,
      },
    });
  });
  return { ok: true };
}

export interface SubmitShipmentInput {
  returnId: string;
  userId: string;
  userName: string;
  trackingCode: string;
  shippingCost: number;
  receiptPath: string;
}

/**
 * ثبت مدارک ارسال مرسوله توسط مشتری (روش self_ship): کد رهگیری، هزینه ارسال
 * و عکس رسید. فقط وقتی مجاز است که درخواست تایید شده و هنوز دریافت نشده.
 */
export async function submitReturnShipment(input: SubmitShipmentInput): Promise<StaffActionResult> {
  const row = await prisma.returnRequest.findUnique({ where: { id: input.returnId } });
  if (!row || row.userId !== input.userId) {
    return { error: 'درخواست مرجوعی یافت نشد.' };
  }
  if (row.status !== 'approved') {
    return { error: 'این درخواست در مرحله ثبت مدارک ارسال نیست.' };
  }
  if (row.returnMethod !== 'self_ship') {
    return { error: 'برای این درخواست ثبت مدارک ارسال لازم نیست.' };
  }

  const trackingCode = (input.trackingCode ?? '').trim();
  if (trackingCode === '' || trackingCode.length > 100) {
    return { error: 'کد رهگیری مرسوله را وارد کنید (حداکثر ۱۰۰ نویسه).' };
  }
  if (
    !Number.isInteger(input.shippingCost) ||
    input.shippingCost < 0 ||
    input.shippingCost > MAX_SHIPPING_COST
  ) {
    return { error: 'هزینه ارسال اعلامی نامعتبر است.' };
  }
  if (typeof input.receiptPath !== 'string' || !IMAGE_PATH_RE.test(input.receiptPath)) {
    return { error: 'عکس رسید مرسوله را بارگذاری کنید.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.returnRequest.update({
      where: { id: row.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        shippingTrackingCode: trackingCode,
        shippingCost: input.shippingCost,
        shippingReceiptPath: input.receiptPath,
      },
    });
    await tx.returnEvent.create({
      data: {
        returnRequestId: row.id,
        toStatus: 'sent',
        message: `مدارک ارسال مرسوله ثبت شد — کد رهگیری: ${trackingCode}`,
        actorRole: 'customer',
        actorName: input.userName,
      },
    });
  });
  return { ok: true };
}

/** ثبت دریافت کالای مرجوعی توسط بک‌آفیس (ارسالی، پیک فروشگاه یا حضوری). */
export async function receiveReturn(
  returnId: string,
  staffName: string
): Promise<StaffActionResult> {
  const row = await prisma.returnRequest.findUnique({ where: { id: returnId } });
  if (!row) {
    return { error: 'درخواست مرجوعی یافت نشد.' };
  }
  if (row.status !== 'approved' && row.status !== 'sent') {
    return { error: 'برای ثبت دریافت، درخواست باید تایید شده باشد.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.returnRequest.update({
      where: { id: row.id },
      data: { status: 'received', receivedAt: new Date() },
    });
    await tx.returnEvent.create({
      data: {
        returnRequestId: row.id,
        toStatus: 'received',
        message: 'کالای مرجوعی دریافت شد.',
        actorRole: 'staff',
        actorName: staffName,
      },
    });
  });
  return { ok: true };
}

export interface SettleInput {
  returnId: string;
  staffName: string;
  /** هزینه ارسال برگشتِ تاییدشده — پیش‌فرض همان اعلامی مشتری (فقط payer=shop). */
  approvedShippingCost?: number | null;
  /**
   * مبلغ نهایی انتخابی برای بازگشت (تومان) — بازگشت جزئی: کمتر از جمع
   * محاسبه‌شده یعنی فروشگاه فقط بخشی را برمی‌گرداند. سمت سرور به بازهٔ
   * [۰، جمع محاسبه‌شده] clamp می‌شود؛ خالی = کل مبلغ محاسبه‌شده.
   */
  refundAmount?: number | null;
}

/**
 * تسویه مرجوعی: واریز مبلغ کالاها + (وقتی هزینه ارسال با فروشگاه است) هزینه
 * تاییدشده به کیف پول مشتری، بازگرداندن موجودی و بستن درخواست — همه در یک
 * تراکنش. ردیف‌های دفتر کیف پول با type 'refund' و ارجاع به displayId
 * مرجوعی ثبت می‌شوند.
 */
export async function settleReturn(
  input: SettleInput
): Promise<{ ok: true; refunded: number } | { error: string }> {
  const row = await prisma.returnRequest.findUnique({
    where: { id: input.returnId },
    include: { order: true },
  });
  if (!row) {
    return { error: 'درخواست مرجوعی یافت نشد.' };
  }
  if (row.status !== 'received') {
    return { error: 'ابتدا دریافت کالا را ثبت کنید.' };
  }

  const itemRefund = row.refundItemsAmount;
  let shippingRefund = 0;
  if (row.shippingPayer === 'shop' && row.returnMethod === 'self_ship') {
    const declared = row.shippingCost ?? 0;
    const approved =
      Number.isInteger(input.approvedShippingCost) && input.approvedShippingCost != null
        ? (input.approvedShippingCost as number)
        : declared;
    // بیش از مبلغ اعلامی مشتری قابل تایید نیست.
    shippingRefund = Math.max(Math.min(approved, declared), 0);
  }
  const computedTotal = itemRefund + shippingRefund;
  // بازگشت جزئی — مبلغ نهایی انتخابی به بازهٔ [۰، جمع محاسبه‌شده] محدود می‌شود.
  const finalRefund =
    Number.isInteger(input.refundAmount) && input.refundAmount != null
      ? Math.max(Math.min(input.refundAmount as number, computedTotal), 0)
      : computedTotal;

  await prisma.$transaction(async (tx) => {
    if (finalRefund === computedTotal) {
      // تسویه کامل — دو ردیف تفکیک‌شده (مبلغ کالاها / هزینهٔ ارسال برگشت).
      if (itemRefund > 0) {
        await creditWallet(tx, {
          userId: row.userId,
          amount: itemRefund,
          type: 'refund',
          reason: `مرجوعی ${row.displayId} — بازگشت مبلغ کالاها`,
          orderId: row.orderId,
        });
      }
      if (shippingRefund > 0) {
        await creditWallet(tx, {
          userId: row.userId,
          amount: shippingRefund,
          type: 'refund',
          reason: `مرجوعی ${row.displayId} — هزینه ارسال برگشت`,
          orderId: row.orderId,
        });
      }
    } else if (finalRefund > 0) {
      // بازگشت جزئی — یک ردیف واریز با همان مبلغ انتخابی.
      await creditWallet(tx, {
        userId: row.userId,
        amount: finalRefund,
        type: 'refund',
        reason: `مرجوعی ${row.displayId} — بازگشت جزئی مبلغ`,
        orderId: row.orderId,
      });
    }

    // بازگرداندن موجودی — قرینه کسرِ placeOrder (variant یا product).
    for (const line of parseReturnLines(row.itemsJson)) {
      if (line.variantId) {
        await tx.productVariant.updateMany({
          where: { id: line.variantId },
          data: { qty: { increment: line.qty } },
        });
        // موجودی کل محصول هم قرینهٔ کسرِ ثبت سفارش برمی‌گردد.
        await tx.product.updateMany({
          where: { id: line.productId },
          data: { qty: { increment: line.qty } },
        });
      } else {
        await tx.product.updateMany({
          where: { id: line.productId },
          data: { qty: { increment: line.qty } },
        });
      }
    }

    await tx.returnRequest.update({
      where: { id: row.id },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
        refundedAmount: finalRefund,
        ...(shippingRefund > 0 ? { shippingCost: shippingRefund } : {}),
      },
    });
    await tx.returnEvent.create({
      data: {
        returnRequestId: row.id,
        toStatus: 'refunded',
        message:
          finalRefund > 0
            ? `${new Intl.NumberFormat('fa-IR').format(finalRefund)} تومان به کیف پول مشتری واریز شد.`
            : 'درخواست تسویه شد — مبلغی برای بازگشت وجود نداشت.',
        actorRole: 'staff',
        actorName: input.staffName,
      },
    });
  });

  return { ok: true, refunded: finalRefund };
}

/** لغو درخواست توسط خود مشتری — فقط تا قبل از تایید. */
export async function cancelReturnRequest(
  returnId: string,
  userId: string,
  userName: string
): Promise<StaffActionResult> {
  const row = await prisma.returnRequest.findUnique({ where: { id: returnId } });
  if (!row || row.userId !== userId) {
    return { error: 'درخواست مرجوعی یافت نشد.' };
  }
  if (row.status !== 'requested') {
    return { error: 'پس از بررسی فروشگاه، لغو درخواست ممکن نیست.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.returnRequest.update({
      where: { id: row.id },
      data: { status: 'cancelled' },
    });
    await tx.returnEvent.create({
      data: {
        returnRequestId: row.id,
        toStatus: 'cancelled',
        message: 'درخواست توسط مشتری لغو شد.',
        actorRole: 'customer',
        actorName: userName,
      },
    });
  });
  return { ok: true };
}

/* ---------------------------------------------------------------------------
 * خواندن — لیست و جزئیات برای پنل و حساب مشتری.
 * ------------------------------------------------------------------------ */

export interface ReturnListItem {
  id: string;
  displayId: string;
  status: ReturnStatus;
  createdAt: Date;
  orderDisplayId: string;
  customerName: string;
  itemCount: number;
  refundItemsAmount: number;
  /** مبلغ نهایی واقعاً واریزشده — فقط برای ردیف‌های تسویه‌شده (بازگشت جزئی ممکن). */
  refundedAmount: number | null;
  returnMethod: ReturnMethod | null;
  shippingPayer: ReturnShippingPayer | null;
  /** مشتری مدارک ارسال را ثبت کرده (کد رهگیری یا عکس رسید) — نشانگر لیست. */
  docsReady: boolean;
}

/** لیست مرجوعی‌های فروشگاه برای پنل — فیلتر وضعیت و جستجوی کد. */
export async function listReturns(filters: {
  status?: string;
  q?: string;
}): Promise<ReturnListItem[]> {
  const ALL_STATUSES: ReturnStatus[] = [
    'requested',
    'approved',
    'sent',
    'received',
    'refunded',
    'rejected',
    'cancelled',
  ];
  const status = ALL_STATUSES.includes(filters.status as ReturnStatus)
    ? (filters.status as ReturnStatus)
    : undefined;
  const q = (filters.q ?? '').trim();

  const rows = await prisma.returnRequest.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [{ displayId: { contains: q } }, { order: { is: { displayId: { contains: q } } } }],
          }
        : {}),
    },
    include: { order: { select: { displayId: true, customer: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return rows.map((row) => ({
    id: row.id,
    displayId: row.displayId,
    status: row.status as ReturnStatus,
    createdAt: row.createdAt,
    orderDisplayId: row.order.displayId,
    customerName: row.order.customer,
    itemCount: parseReturnLines(row.itemsJson).reduce((sum, line) => sum + line.qty, 0),
    refundItemsAmount: row.refundItemsAmount,
    refundedAmount: row.refundedAmount,
    returnMethod: (row.returnMethod as ReturnMethod | null) ?? null,
    shippingPayer: (row.shippingPayer as ReturnShippingPayer | null) ?? null,
    docsReady: Boolean(row.shippingTrackingCode || row.shippingReceiptPath),
  }));
}

/** جزئیات کامل یک درخواست مرجوعی برای پنل — با سفارش، مشتری و تایم‌لاین. */
export async function getReturnDetail(displayId: string) {
  const row = await prisma.returnRequest.findUnique({
    where: { displayId },
    include: {
      order: true,
      user: { select: { id: true, name: true, phone: true } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!row) {
    return null;
  }
  return {
    ...row,
    lines: parseReturnLines(row.itemsJson),
    images: parseReturnImages(row.imagesJson),
  };
}

/** لیست مرجوعی‌های یک مشتری (حساب مشتری). */
export async function listCustomerReturns(userId: string) {
  const rows = await prisma.returnRequest.findMany({
    where: { userId },
    include: { order: { select: { displayId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    displayId: row.displayId,
    status: row.status as ReturnStatus,
    createdAt: row.createdAt,
    orderDisplayId: row.order.displayId,
    itemCount: parseReturnLines(row.itemsJson).reduce((sum, line) => sum + line.qty, 0),
    refundItemsAmount: row.refundItemsAmount,
    refundedAmount: row.refundedAmount,
    returnMethod: (row.returnMethod as ReturnMethod | null) ?? null,
    shippingPayer: (row.shippingPayer as ReturnShippingPayer | null) ?? null,
  }));
}

/** جزئیات یک درخواست مرجوعی برای صاحبش — ردیفِ دیگران null برمی‌گردد. */
export async function getCustomerReturnDetail(displayId: string, userId: string) {
  const row = await prisma.returnRequest.findUnique({
    where: { displayId },
    include: {
      order: true,
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!row || row.userId !== userId) {
    return null;
  }
  return {
    ...row,
    lines: parseReturnLines(row.itemsJson),
    images: parseReturnImages(row.imagesJson),
  };
}
